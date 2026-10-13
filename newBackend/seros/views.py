import base64
import json
import logging
import os
import urllib.error
import urllib.request
from datetime import timedelta
from io import BytesIO

from PIL import Image, ImageDraw
from django.conf import settings
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from .models import Detection, Device, Rule, Section, Zone

logger = logging.getLogger(__name__)

_cached_yolo_model = None


def _get_yolo_model():
    """
    Singleton YOLO model loader.
    Prefers yolov8s.pt for higher accuracy if available, fallback to settings.
    """
    global _cached_yolo_model
    if _cached_yolo_model is None:
        from ultralytics import YOLO
        model_path = getattr(settings, "SEROS_YOLO_MODEL", "")
        base_dir = getattr(settings, "BASE_DIR", None)
        if base_dir:
            s_model = os.path.join(base_dir, "yolov8s.pt")
            if os.path.exists(s_model):
                model_path = s_model
            elif not model_path or not os.path.exists(model_path):
                n_model = os.path.join(base_dir, "yolov8n.pt")
                if os.path.exists(n_model):
                    model_path = n_model
        logger.info("Loading SEROS YOLO model from %s", model_path)
        _cached_yolo_model = YOLO(model_path)
    return _cached_yolo_model


def _json(request):
    try:
        return json.loads(request.body or "{}")
    except json.JSONDecodeError as exc:
        raise ValueError("Request body must be valid JSON.") from exc


def _response(payload, status=200):
    response = JsonResponse(payload, status=status)
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Headers"] = "Content-Type"
    response["Access-Control-Allow-Methods"] = "GET, POST, PATCH, OPTIONS"
    return response


def _inside(point, polygon):
    x, y = point
    inside = False
    for i, current in enumerate(polygon):
        previous = polygon[i - 1]
        if (current[1] > y) != (previous[1] > y):
            crossing = (previous[0] - current[0]) * (y - current[1]) / (previous[1] - current[1]) + current[0]
            if x < crossing:
                inside = not inside
    return inside


def _zone_payload(zone, occupancy=0):
    handles = [{"x": p[0] * 400, "y": p[1] * 320} for p in zone.points]
    return {
        "id": str(zone.id),
        "name": zone.name,
        "statusText": f"● {occupancy} People Detected" if occupancy else "○ Empty",
        "isOccupied": occupancy > 0,
        "occupantCount": occupancy,
        "color": zone.color,
        "shapeType": zone.shape_type,
        "points": " ".join(f"{p[0] * 400:g},{p[1] * 320:g}" for p in zone.points),
        "handles": handles,
        "assignedDeviceIds": list(zone.assigned_devices.values_list("device_id", flat=True)),
    }


QUADRANT_POSITIONS = {
    1: "Top-Left",
    2: "Top-Right",
    3: "Bottom-Left",
    4: "Bottom-Right",
}

QUADRANT_PINS = {
    1: 16,
    2: 17,
    3: 18,
    4: 19,
}


def get_device_quadrant(device):
    """
    Deterministically maps any device to its quadrant (1, 2, 3, or 4):
    1: Top-Left (Relay 1 / GPIO 16)
    2: Top-Right (Relay 2 / GPIO 17)
    3: Bottom-Left (Relay 3 / GPIO 18)
    4: Bottom-Right (Relay 4 / GPIO 19)
    """
    if device.relay in [1, 2, 3, 4]:
        return device.relay
    for z in device.zones.all():
        for q in [1, 2, 3, 4]:
            if f"quadrant {q}" in z.name.lower() or f"q{q}" in z.name.lower():
                return q
    name_l = device.name.lower()
    for q in [1, 2, 3, 4]:
        if f"quadrant {q}" in name_l or f"q{q}" in name_l:
            return q
    id_l = device.device_id.lower()
    for q in [1, 2, 3, 4]:
        if f"q{q}" in id_l or f"quadrant{q}" in id_l:
            return q
    return 1


def _device_payload(device):
    status = "ON" if device.is_on else "OFF"
    assigned_zone = device.zones.first()
    
    quadrant_num = get_device_quadrant(device)
    quadrant_label = f"Quadrant {quadrant_num}"
    quadrant_pos = QUADRANT_POSITIONS.get(quadrant_num, "Top-Left")
    pin = QUADRANT_PINS.get(quadrant_num, 16)

    return {
        "id": device.device_id,
        "name": device.name,
        "room": quadrant_label,
        "roomId": str(device.section_id),
        "quadrant": quadrant_label,
        "quadrantNum": quadrant_num,
        "quadrantPos": quadrant_pos,
        "pin": pin,
        "quadrantId": str(assigned_zone.id) if assigned_zone else str(quadrant_num),
        "category": device.category,
        "status": status,
        "speedLevel": device.speed,
        "powerWatts": device.power_watts if device.is_on else 0,
        "isAutomated": not device.manual_override,
        "automationNote": f"Quadrant {quadrant_num} ({quadrant_pos}) Presence • Relay {quadrant_num}",
        "zoneId": str(assigned_zone.id) if assigned_zone else None,
        "relay": quadrant_num,
        "targetTemperature": device.target_temperature,
    }


def _section_payload(section):
    from .camera_service import is_camera_enabled
    camera_on = is_camera_enabled()

    zones = list(section.zones.all())
    latest_detection = section.detections.order_by("-id").first()
    is_recent = False
    if latest_detection and camera_on:
        age_seconds = (timezone.now() - latest_detection.created_at).total_seconds()
        is_recent = age_seconds < 45

    occupancy = latest_detection.person_count if (latest_detection and is_recent and camera_on) else 0
    boxes = latest_detection.boxes if (latest_detection and is_recent and camera_on) else []

    # Accurate individual zone occupant counting based on human bounding box centroids
    def _zone_occupants(z):
        if not boxes:
            return 0
        return sum(
            1 for b in boxes
            if _inside(((b["x1"] + b["x2"]) / 2, (b["y1"] + b["y2"]) / 2), z.points)
        )

    processed_frame = ""
    if latest_detection and latest_detection.processed_frame and camera_on and is_recent:
        pf = latest_detection.processed_frame
        processed_frame = pf if pf.startswith("data:") else ("data:image/jpeg;base64," + pf)

    return {
        "id": str(section.id),
        "name": section.name,
        "subtitle": section.subtitle,
        "category": "Configurable Section",
        "occupancyCount": occupancy,
        "occupancyText": f"{occupancy} people inside" if occupancy > 0 else "Empty",
        "fansStatus": "ON" if section.devices.filter(category="fans", is_on=True).exists() else "OFF",
        "lightsStatus": "ON" if section.devices.filter(category="lights", is_on=True).exists() else "OFF",
        "icon": "meeting_room",
        "latestFrame": processed_frame,
        "latestBoxes": boxes,
        "lastUpdated": latest_detection.created_at.isoformat() if (latest_detection and is_recent) else None,
        "cameras": [
            {
                "id": f"cam-{section.id}",
                "label": "Live Camera Feed",
                "url": processed_frame,
                "status": "Live" if (latest_detection and camera_on and is_recent) else "Standby",
            }
        ] if processed_frame else [],
        "zones": [_zone_payload(zone, _zone_occupants(zone)) for zone in zones],
    }


def ping(request):
    return _response({"status": "ok", "service": "seros-backend", "time": timezone.now().isoformat()})


def state(request):
    if request.method == "OPTIONS":
        return _response({})
    sections = list(Section.objects.all().order_by("id"))
    return _response({
        "status": "ok",
        "sections": [_section_payload(section) for section in sections],
        "rooms": [_section_payload(section) for section in sections],
        "devices": [_device_payload(device) for device in Device.objects.select_related("section").all()],
        "rules": [{
            "id": str(rule.id), "title": rule.title, "whenText": rule.when_text,
            "thenText": rule.then_text, "isActive": rule.is_active, "triggerCount": 0,
            "kwhSaved": 0, "tag": "Backend rule",
        } for rule in Rule.objects.all()],
    })


def _esp32_request(path, method="GET", payload=None):
    if not settings.SEROS_ESP32_URL:
        return {"status": "unconfigured", "message": "SEROS_ESP32_URL is not configured."}
    url = settings.SEROS_ESP32_URL.rstrip("/") + path
    body = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(url, data=body, method=method,
                                     headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=2) as response:
            return json.loads(response.read().decode())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise ConnectionError(f"ESP32 is unreachable: {exc}") from exc


@csrf_exempt
def devices_api(request):
    if request.method == "OPTIONS":
        return _response({})
    if request.method == "GET":
        devices = Device.objects.select_related("section").prefetch_related("zones").all()
        return _response({"status": "ok", "devices": [_device_payload(d) for d in devices]})
    if request.method == "POST":
        try:
            import uuid
            data = _json(request)

            section_id = data.get("section_id") or data.get("roomId")
            if section_id:
                try:
                    section = Section.objects.get(id=int(section_id))
                except (Section.DoesNotExist, ValueError):
                    section = Section.objects.first()
            else:
                section = Section.objects.first()

            if not section:
                section = Section.objects.create(name="Main Camera Area", subtitle="4-Quadrant Setup")

            # Determine Quadrant (1, 2, 3, or 4)
            quadrant_raw = data.get("quadrant") or data.get("zoneId") or data.get("zone_id") or 1
            quadrant_num = 1
            if str(quadrant_raw).isdigit() and int(quadrant_raw) in [1, 2, 3, 4]:
                quadrant_num = int(quadrant_raw)
            elif "1" in str(quadrant_raw):
                quadrant_num = 1
            elif "2" in str(quadrant_raw):
                quadrant_num = 2
            elif "3" in str(quadrant_raw):
                quadrant_num = 3
            elif "4" in str(quadrant_raw):
                quadrant_num = 4

            # Ensure the quadrant zone exists
            quadrant_name = f"Quadrant {quadrant_num}"
            zone = Zone.objects.filter(section=section, name__icontains=quadrant_name).first()
            if not zone:
                quadrant_points_map = {
                    1: [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]],
                    2: [[0.5, 0], [1, 0], [1, 0.5], [0.5, 0.5]],
                    3: [[0, 0.5], [0.5, 0.5], [0.5, 1], [0, 1]],
                    4: [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1]],
                }
                zone = Zone.objects.create(
                    section=section,
                    name=quadrant_name,
                    points=quadrant_points_map.get(quadrant_num, [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]]),
                    shape_type="rectangle",
                )

            category = (data.get("category") or "lights").lower()
            if category not in ["lights", "fans", "ac"]:
                category = "lights"

            name = (data.get("name") or "").strip()
            if not name:
                name = f"{quadrant_name} {category.capitalize()}"

            device_id = data.get("device_id") or data.get("id")
            if not device_id:
                device_id = f"dev-q{quadrant_num}-{category}-{uuid.uuid4().hex[:6]}"

            if Device.objects.filter(device_id=device_id).exists():
                device_id = f"{device_id}-{uuid.uuid4().hex[:4]}"

            relay = data.get("relay")
            if relay is None or str(relay).strip() == "":
                relay = quadrant_num  # default relay to quadrant number (1, 2, 3, or 4)
            relay = int(relay) if str(relay).isdigit() else quadrant_num

            default_watts = 44.0 if category == "lights" else (38.0 if category == "fans" else 1200.0)
            power_watts = float(data.get("power_watts") or default_watts)

            device = Device.objects.create(
                section=section,
                device_id=device_id,
                name=name,
                category=category,
                relay=relay,
                power_watts=power_watts,
                is_on=False,
                speed=0,
            )

            # Assign device to its quadrant zone
            zone.assigned_devices.add(device)

            return _response({"status": "ok", "device": _device_payload(device)}, 201)
        except Exception as exc:
            return _response({"error": str(exc)}, 400)
    return _response({"error": "Method not allowed."}, 405)


@csrf_exempt
def device_detail(request, device_id):
    if request.method == "OPTIONS":
        return _response({})
    if request.method == "DELETE":
        try:
            device = Device.objects.get(device_id=device_id)
            device.zones.clear()
            device.delete()
            return _response({"status": "ok", "deleted_id": device_id})
        except Device.DoesNotExist:
            return _response({"error": "Device not found."}, 404)
        except Exception as exc:
            return _response({"error": str(exc)}, 400)
    elif request.method in ["PUT", "PATCH", "POST"]:
        try:
            data = _json(request)
            if data.get("action") == "delete":
                device = Device.objects.get(device_id=device_id)
                device.zones.clear()
                device.delete()
                return _response({"status": "ok", "deleted_id": device_id})

            device = Device.objects.get(device_id=device_id)
            if "name" in data and str(data["name"]).strip():
                device.name = str(data["name"]).strip()
            if "category" in data and str(data["category"]).lower() in ["lights", "fans", "ac"]:
                device.category = str(data["category"]).lower()
            if "power_watts" in data:
                try:
                    device.power_watts = float(data["power_watts"])
                except (ValueError, TypeError):
                    pass

            quadrant_raw = data.get("quadrant") or data.get("quadrantNum") or data.get("relay")
            if quadrant_raw is not None and str(quadrant_raw).isdigit():
                q_num = int(quadrant_raw)
                if q_num in [1, 2, 3, 4]:
                    device.relay = q_num
                    quadrant_name = f"Quadrant {q_num}"
                    zone = Zone.objects.filter(section=device.section, name__icontains=quadrant_name).first()
                    if zone:
                        device.zones.clear()
                        zone.assigned_devices.add(device)

            device.save()
            return _response({"status": "ok", "device": _device_payload(device)})
        except Device.DoesNotExist:
            return _response({"error": "Device not found."}, 404)
        except Exception as exc:
            return _response({"error": str(exc)}, 400)
    return _response({"error": "Method not allowed."}, 405)


delete_device = device_detail


@csrf_exempt
def control_device(request, device_id):
    if request.method == "OPTIONS":
        return _response({})
    if request.method != "POST":
        return _response({"error": "Use POST."}, 405)
    try:
        data = _json(request)
        device = Device.objects.get(device_id=device_id)
        if "manual_override" in data:
            device.manual_override = bool(data["manual_override"])
        if "on" in data:
            device.is_on = bool(data["on"])
        if "speed" in data:
            device.speed = max(0, min(3, int(data["speed"])))
            device.is_on = device.speed > 0
        device.save()
        if device.relay:
            _esp32_request(f"/api/relay?id={device.relay}&state={int(device.is_on)}")
        return _response({"status": "ok", "device": _device_payload(device)})
    except Device.DoesNotExist:
        return _response({"error": "Device not found."}, 404)
    except (ValueError, TypeError) as exc:
        return _response({"error": str(exc)}, 400)
    except ConnectionError as exc:
        return _response({"error": str(exc), "device": _device_payload(device)}, 503)


@csrf_exempt
def update_zone(request, zone_id):
    if request.method == "OPTIONS":
        return _response({})
    if request.method != "PATCH":
        return _response({"error": "Use PATCH."}, 405)
    try:
        data = _json(request)
        zone = Zone.objects.get(id=zone_id)
        points = data.get("points", zone.points)
        if not isinstance(points, list) or len(points) < 3:
            raise ValueError("A zone needs at least three normalized points.")
        if any(not isinstance(p, list) or len(p) != 2 or not all(0 <= float(v) <= 1 for v in p) for p in points):
            raise ValueError("Zone points must be normalized [0..1] coordinate pairs.")
        zone.points = [[float(p[0]), float(p[1])] for p in points]
        zone.name = data.get("name", zone.name)
        zone.shape_type = data.get("shapeType", zone.shape_type)
        if "assignedDeviceIds" in data:
            zone.assigned_devices.set(Device.objects.filter(device_id__in=data["assignedDeviceIds"]))
        zone.save()
        return _response({"status": "ok", "zone": _zone_payload(zone)})
    except Zone.DoesNotExist:
        return _response({"error": "Zone not found."}, 404)
    except (ValueError, TypeError, KeyError) as exc:
        return _response({"error": str(exc)}, 400)


def _apply_automation(section_id, boxes):
    """
    Real-time quadrant occupancy automation:
    - Turns ON devices & relays ONLY for quadrants with a person currently detected.
    - Turns OFF devices & relays for all other quadrants where no person is detected.
    - Synchronizes relay state directly with ESP32 LAN controller.
    """
    # 1. Determine which quadrants currently have at least one detected human
    quadrant_occupied = {1: False, 2: False, 3: False, 4: False}

    for b in boxes:
        cx = (float(b.get("x1", 0)) + float(b.get("x2", 0))) / 2.0
        cy = (float(b.get("y1", 0)) + float(b.get("y2", 0))) / 2.0

        if cx < 0.5 and cy < 0.5:
            quadrant_occupied[1] = True
        elif cx >= 0.5 and cy < 0.5:
            quadrant_occupied[2] = True
        elif cx < 0.5 and cy >= 0.5:
            quadrant_occupied[3] = True
        else:
            quadrant_occupied[4] = True

    # 2. Update all devices per quadrant and synchronize hardware relays
    all_devices = list(Device.objects.all())

    for q in [1, 2, 3, 4]:
        is_occupied = quadrant_occupied[q]

        # Gather devices assigned to this quadrant
        q_devices = [d for d in all_devices if get_device_quadrant(d) == q]

        for dev in q_devices:
            new_is_on = bool(is_occupied)
            new_speed = (2 if dev.category == "fans" else 0) if is_occupied else 0

            if dev.is_on != new_is_on or dev.speed != new_speed or dev.relay != q or dev.manual_override:
                dev.is_on = new_is_on
                dev.speed = new_speed
                dev.relay = q
                dev.manual_override = False
                dev.save(update_fields=["is_on", "speed", "relay", "manual_override"])

        # Send command to ESP32 to switch Relay q ON/OFF immediately
        relay_state = 1 if is_occupied else 0
        try:
            _esp32_request(f"/api/relay?id={q}&state={relay_state}")
        except Exception as exc:
            logger.debug("ESP32 relay %d command failed: %s", q, exc)

    return quadrant_occupied


def process_image_and_record(image, section_id=1):
    """
    Core YOLO inference strictly detecting humans (COCO class 0: 'person').
    Rejects any other object completely.
    Renders bounding boxes, centroid dots, confidence badges, and status banner.
    Saves Detection to database, runs automations, and returns response dictionary.
    """
    model = _get_yolo_model()

    # STRICT FILTER: classes=[0] ensures inference detects human/person class only.
    # conf=0.35 rejects low-confidence spurious noise.
    results = model.predict(image, classes=[0], conf=0.35, verbose=False)
    result = results[0]

    width, height = image.size
    boxes = []

    if hasattr(result, "boxes") and result.boxes is not None and len(result.boxes) > 0:
        xyxys = result.boxes.xyxy.tolist()
        confs = result.boxes.conf.tolist()
        classes = result.boxes.cls.tolist()

        for box, conf, cls_id in zip(xyxys, confs, classes):
            # Strict double verification: Must be class 0 ('person' / human).
            # Any other object (dogs, chairs, backpacks, cars, etc.) is rejected.
            if int(cls_id) != 0:
                continue
            if conf < 0.35:
                continue

            x1, y1, x2, y2 = box
            # Clamp normalized coordinates strictly within [0.0, 1.0]
            nx1 = max(0.0, min(1.0, float(x1) / width))
            ny1 = max(0.0, min(1.0, float(y1) / height))
            nx2 = max(0.0, min(1.0, float(x2) / width))
            ny2 = max(0.0, min(1.0, float(y2) / height))

            boxes.append({
                "x1": round(nx1, 4),
                "y1": round(ny1, 4),
                "x2": round(nx2, 4),
                "y2": round(ny2, 4),
                "confidence": round(float(conf), 4),
                "label": "Human"
            })

    # Render clean visual bounding boxes and annotations for mobile stream
    annotated = image.copy()
    draw = ImageDraw.Draw(annotated)

    for b in boxes:
        bx1 = int(b["x1"] * width)
        by1 = int(b["y1"] * height)
        bx2 = int(b["x2"] * width)
        by2 = int(b["y2"] * height)
        cx = int(((b["x1"] + b["x2"]) / 2) * width)
        cy = int(((b["y1"] + b["y2"]) / 2) * height)

        # 1. Vibrant Green bounding box for human
        draw.rectangle([bx1, by1, bx2, by2], outline="#00E676", width=3)

        # 2. Centroid marker (red circle with white border)
        draw.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill="#FF1744", outline="#FFFFFF", width=2)

        # 3. Confidence badge banner
        label = f"Human {int(b['confidence'] * 100)}%"
        badge_w = 90
        badge_h = 18
        draw.rectangle([bx1, max(0, by1 - badge_h), bx1 + badge_w, by1], fill="#00E676")
        draw.text((bx1 + 4, max(0, by1 - badge_h + 2)), label, fill="#000000")

    # 4. Top status header
    header_text = f"SEROS AI • Humans Detected: {len(boxes)}"
    draw.rectangle([10, 10, 240, 32], fill="#111827")
    draw.text((18, 14), header_text, fill="#00E676")

    output = BytesIO()
    annotated.save(output, format="JPEG", quality=82)
    processed_frame = "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode()

    # Save to database
    try:
        section = Section.objects.get(id=int(section_id))
    except (Section.DoesNotExist, ValueError):
        section = Section.objects.first()

    quadrant_occupied = {1: False, 2: False, 3: False, 4: False}
    if section:
        Detection.objects.create(
            section=section,
            person_count=len(boxes),
            boxes=boxes,
            processed_frame=processed_frame
        )
        quadrant_occupied = _apply_automation(section.id, boxes) or quadrant_occupied

    return {
        "status": "ok",
        "people": len(boxes),
        "boxes": boxes,
        "processed_frame": processed_frame,
        "devices": [_device_payload(d) for d in Device.objects.all()],
        "quadrant_occupied": quadrant_occupied,
    }


@csrf_exempt
def detect(request):
    if request.method == "OPTIONS":
        return _response({})
    if request.method != "POST":
        return _response({"error": "Use POST."}, 405)
    from .camera_service import is_camera_enabled
    if not is_camera_enabled():
        return _response({
            "status": "camera_off",
            "enabled": False,
            "person_count": 0,
            "boxes": [],
            "processed_frame": ""
        })
    try:
        # Inform background camera service that an external client is sending frames
        try:
            from .camera_service import mark_external_detection
            mark_external_detection()
        except Exception:
            pass

        data = _json(request)
        raw = data.get("image", "")
        if not raw:
            return _response({"error": "No image data provided."}, 400)
        if "," in raw:
            raw = raw.split(",", 1)[1]
        image_bytes = base64.b64decode(raw)
        image = Image.open(BytesIO(image_bytes)).convert("RGB")

        section_id = data.get("section_id", 1)
        res = process_image_and_record(image, section_id=section_id)
        return _response(res)
    except (ValueError, TypeError, KeyError, base64.binascii.Error) as exc:
        return _response({"error": str(exc)}, 400)
    except Section.DoesNotExist:
        return _response({"error": "Section not found."}, 404)
    except Exception as exc:
        logger.exception("Error during detection")
        return _response({"error": str(exc)}, 500)


def latest_camera_frame(request):
    if request.method == "OPTIONS":
        return _response({})
    from .camera_service import is_camera_enabled
    if not is_camera_enabled():
        return _response({
            "status": "off",
            "enabled": False,
            "section_id": 1,
            "people": 0,
            "boxes": [],
            "frame": None,
            "timestamp": None
        })

    section_id = request.GET.get("section_id", 1)
    try:
        section = Section.objects.get(id=int(section_id))
    except (Section.DoesNotExist, ValueError):
        section = Section.objects.first()

    latest = section.detections.order_by("-id").first() if section else None
    if not latest:
        return _response({
            "status": "ok",
            "enabled": True,
            "section_id": section.id if section else 1,
            "people": 0,
            "boxes": [],
            "frame": None,
            "timestamp": None
        })

    age = (timezone.now() - latest.created_at).total_seconds()
    if age > 45:
        return _response({
            "status": "ok",
            "enabled": True,
            "section_id": section.id if section else 1,
            "people": 0,
            "boxes": [],
            "frame": None,
            "timestamp": None
        })

    frame = latest.processed_frame
    if frame and not frame.startswith("data:"):
        frame = "data:image/jpeg;base64," + frame

    return _response({
        "status": "ok",
        "enabled": True,
        "section_id": section.id if section else 1,
        "people": latest.person_count,
        "boxes": latest.boxes,
        "frame": frame,
        "timestamp": latest.created_at.isoformat()
    })


@csrf_exempt
def camera_status(request):
    from .camera_service import is_camera_enabled, set_camera_enabled
    if request.method == "OPTIONS":
        return _response({})
    if request.method == "POST":
        data = _json(request)
        if "enabled" in data:
            new_state = bool(data["enabled"])
            set_camera_enabled(new_state)
            if not new_state:
                _apply_automation(1, [])
        elif data.get("toggle"):
            new_state = not is_camera_enabled()
            set_camera_enabled(new_state)
            if not new_state:
                _apply_automation(1, [])
    return _response({"status": "ok", "enabled": is_camera_enabled()})


@csrf_exempt
def sections_api(request):
    if request.method == "OPTIONS":
        return _response({})
    if request.method == "GET":
        sections = Section.objects.all()
        return _response({"status": "ok", "sections": [_section_payload(s) for s in sections]})
    if request.method == "POST":
        try:
            data = _json(request)
            name = (data.get("name") or "").strip()
            if not name:
                count = Section.objects.count() + 1
                name = f"Section {count}"
            subtitle = (data.get("subtitle") or "Configurable camera section").strip()
            square_feet = int(data.get("square_feet") or 1400)
            camera_name = (data.get("camera_name") or f"{name} Camera").strip()

            section = Section.objects.create(
                name=name,
                subtitle=subtitle,
                camera_url=(data.get("camera_url") or "").strip(),
            )

            # Initialize 4 standard quadrant zones for the newly added section
            quadrants = [
                ("Quadrant 1", [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]]),
                ("Quadrant 2", [[0.5, 0], [1, 0], [1, 0.5], [0.5, 0.5]]),
                ("Quadrant 3", [[0, 0.5], [0.5, 0.5], [0.5, 1], [0, 1]]),
                ("Quadrant 4", [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1]]),
            ]
            for zone_name, points in quadrants:
                Zone.objects.create(
                    section=section,
                    name=zone_name,
                    points=points,
                    shape_type="rectangle",
                )

            return _response({"status": "ok", "section": _section_payload(section)}, 201)
        except Exception as exc:
            return _response({"error": str(exc)}, 400)
    return _response({"error": "Method not allowed."}, 405)


@csrf_exempt
def delete_section(request, section_id):
    if request.method == "OPTIONS":
        return _response({})
    if request.method not in ["DELETE", "POST"]:
        return _response({"error": "Use DELETE or POST."}, 405)
    try:
        section = Section.objects.get(id=int(section_id))
        section_name = section.name
        # Clear device relations and delete
        for device in section.devices.all():
            device.zones.clear()
            device.delete()
        section.zones.all().delete()
        section.detections.all().delete()
        section.delete()
        return _response({"status": "ok", "deleted_id": str(section_id), "name": section_name})
    except Section.DoesNotExist:
        return _response({"error": "Section not found."}, 404)
    except Exception as exc:
        return _response({"error": str(exc)}, 400)


def cameras(request):
    return _response({"status": "ok", "cameras": [{"id": 0, "name": "Laptop webcam", "deviceId": "browser"}]})


def esp32_status(request):
    try:
        return _response(_esp32_request("/api/status"))
    except ConnectionError as exc:
        return _response({"status": "unreachable", "error": str(exc)}, 503)
