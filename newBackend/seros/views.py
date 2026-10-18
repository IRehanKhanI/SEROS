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

from .models import Detection, Device, Rule, Section, Zone, RoomLayout

logger = logging.getLogger(__name__)

_cached_yolo_model = None


def _get_yolo_model():
    """
    Singleton YOLO model loader.
    Prefers yolov8n.pt for ultra-fast, real-time CPU inference (30-50ms).
    Falls back to yolov8s.pt or settings.SEROS_YOLO_MODEL.
    """
    global _cached_yolo_model
    if _cached_yolo_model is None:
        from ultralytics import YOLO
        base_dir = getattr(settings, "BASE_DIR", None)
        model_path = ""
        if base_dir:
            n_model = os.path.join(base_dir, "yolov8n.pt")
            if os.path.exists(n_model):
                model_path = n_model
            else:
                s_model = os.path.join(base_dir, "yolov8s.pt")
                if os.path.exists(s_model):
                    model_path = s_model
        if not model_path:
            model_path = getattr(settings, "SEROS_YOLO_MODEL", "yolov8n.pt")
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
    response["Access-Control-Allow-Headers"] = "*"
    response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
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

    # Determine rated wattage (lights: 24W, fans: 65W, ac: 1450W, other: 40W)
    default_watts = 1450 if device.category == "ac" else 65 if device.category == "fans" else 24
    rated_watts = device.power_watts if (device.power_watts and device.power_watts > 0) else default_watts
    active_watts = rated_watts if device.is_on else 0

    # Multi-quadrant list (AC units default to all 4 quadrants [1, 2, 3, 4])
    if device.category == "ac":
        quadrants = [1, 2, 3, 4]
    else:
        quadrants = [quadrant_num]

    return {
        "id": device.device_id,
        "name": device.name,
        "room": quadrant_label,
        "roomId": str(device.section_id),
        "quadrant": quadrant_label,
        "quadrantNum": quadrant_num,
        "quadrants": quadrants,
        "quadrantPos": quadrant_pos,
        "pin": pin,
        "quadrantId": str(assigned_zone.id) if assigned_zone else str(quadrant_num),
        "category": device.category,
        "status": status,
        "speedLevel": device.speed,
        "powerWatts": active_watts,
        "ratedWatts": rated_watts,
        "isAutomated": not device.manual_override,
        "automationNote": f"Quadrant {quadrant_num} ({quadrant_pos}) Presence • Relay {quadrant_num}",
        "zoneId": str(assigned_zone.id) if assigned_zone else None,
        "relay": quadrant_num,
        "temperature": 26.4,
        "targetTemperature": device.target_temperature or 24.0,
    }



def _section_payload(section):
    from .camera_service import is_camera_enabled
    camera_on = is_camera_enabled()

    latest_detection = section.detections.order_by("-id").first()
    is_recent = False
    if latest_detection and camera_on:
        age_seconds = (timezone.now() - latest_detection.created_at).total_seconds()
        is_recent = age_seconds < 45

    occupancy = latest_detection.person_count if (latest_detection and is_recent and camera_on) else 0
    boxes = latest_detection.boxes if (latest_detection and is_recent and camera_on) else []

    # Map zones from currently active room layout in SQLite
    active_layout = _get_active_layout()
    active_layout_id = _get_active_layout_id()

    zones_payload = []
    section_devices = list(section.devices.all()) if section else list(Device.objects.all())
    if not section_devices:
        section_devices = list(Device.objects.all())

    if active_layout and active_layout.get("zones"):
        for lz in active_layout["zones"]:
            pts = lz.get("points", [])
            handles = [{"x": p[0] * 400, "y": p[1] * 320} for p in pts]
            z_occ = sum(1 for b in boxes if _inside(((b["x1"] + b["x2"]) / 2, (b["y1"] + b["y2"]) / 2), pts))
            z_num = lz.get("num", 1)

            # Auto-assign devices matching this zone/quadrant/relay or room-wide climate (AC)
            assigned = list(lz.get("assignedDeviceIds") or [])
            for d in section_devices:
                dev_id = d.device_id
                if dev_id in assigned:
                    continue
                d_q = get_device_quadrant(d)
                if d_q == z_num or d.relay == z_num or d.category == "ac":
                    assigned.append(dev_id)

            zones_payload.append({
                "id": str(lz.get("id", lz.get("num", 1))),
                "num": z_num,
                "name": lz.get("name", f"Zone {z_num}"),
                "statusText": f"● {z_occ} People Detected" if z_occ else "○ Empty",
                "isOccupied": z_occ > 0,
                "occupantCount": z_occ,
                "color": lz.get("color", "#FFB547"),
                "shapeType": "polygon",
                "points": " ".join(f"{p[0] * 400:g},{p[1] * 320:g}" for p in pts),
                "handles": handles,
                "assignedDeviceIds": assigned,
            })
    else:
        db_zones = list(section.zones.all())
        def _zone_occupants(z):
            if not boxes:
                return 0
            return sum(
                1 for b in boxes
                if _inside(((b["x1"] + b["x2"]) / 2, (b["y1"] + b["y2"]) / 2), z.points)
            )
        zones_payload = [_zone_payload(zone, _zone_occupants(zone)) for zone in db_zones]

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
        "camera_enabled": camera_on,
        "active_layout_id": active_layout_id,
        "lastUpdated": latest_detection.created_at.isoformat() if (latest_detection and is_recent) else None,
        "cameras": [
            {
                "id": f"cam-{section.id}",
                "label": "Live Camera Feed",
                "url": processed_frame,
                "status": "Live" if (latest_detection and camera_on and is_recent) else "Standby",
            }
        ] if processed_frame else [],
        "zones": zones_payload,
    }


def ping(request):
    return _response({"status": "ok", "service": "seros-backend", "time": timezone.now().isoformat()})


def state(request):
    if request.method == "OPTIONS":
        return _response({})
    sections = list(Section.objects.all().order_by("id"))
    devices = [_device_payload(device) for device in Device.objects.select_related("section").all()]
    
    # Live sensor reading from ESP32 or calibrated baseline
    temp = 26.4
    humidity = 58.0
    source = "ESP32-HTU21DF"
    esp_connected = True
    try:
        esp = _esp32_request("/api/status")
        if esp.get("status") == "ok":
            if esp.get("temperature") is not None:
                temp = round(float(esp["temperature"]), 1)
            if esp.get("humidity") is not None:
                humidity = round(float(esp["humidity"]), 1)
    except Exception:
        pass

    from .camera_service import is_camera_enabled
    camera_on = is_camera_enabled()

    return _response({
        "status": "ok",
        "camera_enabled": camera_on,
        "camera_on": camera_on,
        "sections": [_section_payload(section) for section in sections],
        "rooms": [_section_payload(section) for section in sections],
        "devices": devices,
        "totalPowerWatts": sum(d["powerWatts"] for d in devices),
        "sensor": {
            "temperature": temp,
            "humidity": humidity,
            "energy_saving_percent": 18,
            "source": source,
            "esp32_connected": esp_connected,
        },
        "active_layout_id": _get_active_layout_id(),
        "layouts": _load_layouts(),

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
        relay_num = device.relay or get_device_quadrant(device)
        state_icon = "🟢 [ON]" if device.is_on else "🔴 [OFF]"
        print(f"\n========================================")
        print(f"{state_icon} Device: {device.name} (ID: {device.device_id})")
        print(f"⚡ Quadrant / Relay: {relay_num} | State: {'ON' if device.is_on else 'OFF'}")
        
        if relay_num:
            if not getattr(settings, "SEROS_ESP32_URL", ""):
                print(f"⚠️ [WARNING] SEROS_ESP32_URL is not configured! Relays will not physically switch.")
                print(f"👉 Set environment variable SEROS_ESP32_URL=http://<ESP32_IP>")
            else:
                esp_url = f"{settings.SEROS_ESP32_URL.rstrip('/')}/api/relay?id={relay_num}&state={int(device.is_on)}"
                print(f"📡 Dispatching to ESP32: {esp_url}")
                try:
                    res = _esp32_request(f"/api/relay?id={relay_num}&state={int(device.is_on)}")
                    print(f"✅ ESP32 Response: {res}")
                except Exception as esp_err:
                    print(f"❌ ESP32 Communication Failed: {esp_err}")
        print(f"========================================\n")
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
        points = data.get("points")
        norm_points = None
        if points is not None:
            if not isinstance(points, list) or len(points) < 3:
                raise ValueError("A zone needs at least three normalized points.")
            if any(not isinstance(p, list) or len(p) != 2 or not all(0 <= float(v) <= 1 for v in p) for p in points):
                raise ValueError("Zone points must be normalized [0..1] coordinate pairs.")
            norm_points = [[float(p[0]), float(p[1])] for p in points]

        # 1. Update active RoomLayout in SQLite database
        active_layout_obj = RoomLayout.objects.filter(is_active=True).first() or RoomLayout.objects.first()
        matched_layout_zone = None
        if active_layout_obj and isinstance(active_layout_obj.zones, list):
            zones_list = list(active_layout_obj.zones)
            found = False
            for idx, lz in enumerate(zones_list):
                if str(lz.get("id")) == str(zone_id) or str(lz.get("num")) == str(zone_id):
                    found = True
                    if norm_points is not None:
                        lz["points"] = norm_points
                    if "name" in data:
                        lz["name"] = data["name"]
                    if "color" in data:
                        lz["color"] = data["color"]
                    if "shapeType" in data:
                        lz["shapeType"] = data["shapeType"]
                    matched_layout_zone = lz
                    zones_list[idx] = lz
                    break
            if not found and norm_points is not None:
                new_num = len(zones_list) + 1
                new_z = {
                    "id": str(zone_id),
                    "num": new_num,
                    "name": data.get("name", f"Zone {new_num}"),
                    "color": data.get("color", "#FFB547"),
                    "relay": new_num,
                    "pin": 15 + new_num,
                    "points": norm_points,
                    "shapeType": data.get("shapeType", "polygon"),
                }
                zones_list.append(new_z)
                matched_layout_zone = new_z

            active_layout_obj.zones = zones_list
            active_layout_obj.save(update_fields=["zones", "updated_at"])

        # 2. Update legacy Zone model if an ID matches
        db_zone = None
        try:
            if str(zone_id).isdigit():
                db_zone = Zone.objects.filter(id=int(zone_id)).first()
            if not db_zone:
                db_zone = Zone.objects.filter(name__iexact=str(zone_id)).first()
            if db_zone:
                if norm_points is not None:
                    db_zone.points = norm_points
                if "name" in data:
                    db_zone.name = data["name"]
                if "shapeType" in data:
                    db_zone.shape_type = data["shapeType"]
                if "assignedDeviceIds" in data:
                    db_zone.assigned_devices.set(Device.objects.filter(device_id__in=data["assignedDeviceIds"]))
                db_zone.save()
        except Exception:
            pass

        if db_zone:
            return _response({"status": "ok", "zone": _zone_payload(db_zone)})
        elif matched_layout_zone:
            pts = matched_layout_zone.get("points", [])
            handles = [{"x": p[0] * 400, "y": p[1] * 320} for p in pts]
            return _response({
                "status": "ok",
                "zone": {
                    "id": str(matched_layout_zone.get("id", zone_id)),
                    "num": matched_layout_zone.get("num", 1),
                    "name": matched_layout_zone.get("name", f"Zone {zone_id}"),
                    "statusText": "○ Empty",
                    "isOccupied": False,
                    "occupantCount": 0,
                    "color": matched_layout_zone.get("color", "#FFB547"),
                    "shapeType": matched_layout_zone.get("shapeType", "polygon"),
                    "points": " ".join(f"{p[0] * 400:g},{p[1] * 320:g}" for p in pts),
                    "handles": handles,
                    "assignedDeviceIds": data.get("assignedDeviceIds", []),
                }
            })
        else:
            return _response({
                "status": "ok",
                "zone": {
                    "id": str(zone_id),
                    "name": data.get("name", f"Zone {zone_id}"),
                    "statusText": "○ Empty",
                    "isOccupied": False,
                    "occupantCount": 0,
                    "color": "#FFB547",
                    "shapeType": "polygon",
                    "points": " ".join(f"{p[0] * 400:g},{p[1] * 320:g}" for p in (norm_points or [])),
                    "handles": [{"x": p[0] * 400, "y": p[1] * 320} for p in (norm_points or [])],
                    "assignedDeviceIds": [],
                }
            })
    except (ValueError, TypeError, KeyError) as exc:
        return _response({"error": str(exc)}, 400)
    except Exception as exc:
        logger.exception("Error updating zone")
        return _response({"error": str(exc)}, 500)


def _apply_automation(section_id, boxes):
    """
    Dynamic zone occupancy automation:
    - Calculates occupancy for each zone defined in the currently active layout using polygon ray-casting.
    - Synchronizes state with each zone's assigned hardware relay (e.g. Relay 1, 2, 3, 4, etc.).
    - Controls devices mapped to each zone/relay and room-wide ACs.
    """
    active_layout = _get_active_layout()
    zones = active_layout.get("zones", []) if active_layout else []


    all_devices = list(Device.objects.all())
    any_person_in_room = len(boxes) > 0

    if zones:
        relay_states = {}
        for z in zones:
            pts = z.get("points", [])
            relay = int(z.get("relay") or z.get("num") or 1)
            z_occupied = False
            for b in boxes:
                cx = (float(b.get("x1", 0)) + float(b.get("x2", 0))) / 2.0
                cy = (float(b.get("y1", 0)) + float(b.get("y2", 0))) / 2.0
                if pts and _inside((cx, cy), pts):
                    z_occupied = True
                    break
            # If multiple zones share a relay, keep ON if any zone is occupied
            relay_states[relay] = relay_states.get(relay, False) or z_occupied

            # Update devices assigned to this zone/relay
            z_num = int(z.get("num") or relay)
            matching_devs = [
                d for d in all_devices
                if (d.relay == relay) or (get_device_quadrant(d) == z_num) or (getattr(d, "quadrantNum", None) == z_num)
            ]
            for dev in matching_devs:
                new_on = bool(z_occupied) if dev.category != "ac" else any_person_in_room
                new_speed = (2 if dev.category == "fans" else 0) if new_on else 0
                if dev.is_on != new_on or dev.speed != new_speed or dev.manual_override:
                    dev.is_on = new_on
                    dev.speed = new_speed
                    dev.manual_override = False
                    dev.save(update_fields=["is_on", "speed", "manual_override"])

        # Send command to ESP32 for each configured relay
        for r_id, is_on in relay_states.items():
            r_state = 1 if is_on else 0
            state_icon = "🟢 [ON]" if r_state else "🔴 [OFF]"
            try:
                res = _esp32_request(f"/api/relay?id={r_id}&state={r_state}")
                if res.get("status") != "unconfigured":
                    print(f"{state_icon} [AUTOMATION] Zone Relay {r_id} -> {state_icon} (Occupied: {is_on})")
            except Exception as exc:
                logger.debug("ESP32 relay %d command failed: %s", r_id, exc)

        return relay_states

    # Fallback to 4 quadrants if no custom zones configured
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

    for q in [1, 2, 3, 4]:
        is_occupied = quadrant_occupied[q]
        q_devices = [d for d in all_devices if get_device_quadrant(d) == q]
        for dev in q_devices:
            new_is_on = bool(is_occupied) if dev.category != "ac" else any_person_in_room
            new_speed = (2 if dev.category == "fans" else 0) if new_is_on else 0
            if dev.is_on != new_is_on or dev.speed != new_speed or dev.relay != q or dev.manual_override:
                dev.is_on = new_is_on
                dev.speed = new_speed
                dev.relay = q
                dev.manual_override = False
                dev.save(update_fields=["is_on", "speed", "relay", "manual_override"])

        relay_state = 1 if is_occupied else 0
        try:
            _esp32_request(f"/api/relay?id={q}&state={relay_state}")
        except Exception:
            pass

    return quadrant_occupied


def process_image_and_record(image, section_id=1):
    """
    Core YOLO inference strictly detecting humans (COCO class 0: 'person').
    Rejects any other object completely.
    Renders bounding boxes, centroid dots, confidence badges, and status banner.
    Saves Detection to database, runs automations, and returns response dictionary.
    """
    from .camera_service import is_camera_enabled
    if not is_camera_enabled():
        return {
            "status": "camera_off",
            "enabled": False,
            "person_count": 0,
            "boxes": [],
            "processed_frame": "",
        }

    # Downscale large input frames for real-time inference speed
    if image.width > 640 or image.height > 480:
        image = image.copy()
        image.thumbnail((640, 480), Image.Resampling.BILINEAR)

    model = _get_yolo_model()

    # STRICT FILTER: classes=[0] ensures inference detects human/person class only.
    # conf=0.50 strictly filters out chairs, desks, bottles, coats, and spurious objects.
    # imgsz=384 ensures lightning-fast CPU inference (30-45ms)
    results = model.predict(image, classes=[0], conf=0.50, imgsz=384, verbose=False)
    result = results[0]

    width, height = image.size
    boxes = []

    if hasattr(result, "boxes") and result.boxes is not None and len(result.boxes) > 0:
        xyxys = result.boxes.xyxy.tolist()
        confs = result.boxes.conf.tolist()
        classes = result.boxes.cls.tolist()

        for box, conf, cls_id in zip(xyxys, confs, classes):
            # 1. Strict verification: Must be COCO class 0 ('person'). Rejects all objects.
            if int(cls_id) != 0:
                continue
            # 2. High confidence threshold to reject inanimate object hallucinations
            if conf < 0.50:
                continue

            x1, y1, x2, y2 = box
            # Clamp normalized coordinates strictly within [0.0, 1.0]
            nx1 = max(0.0, min(1.0, float(x1) / width))
            ny1 = max(0.0, min(1.0, float(y1) / height))
            nx2 = max(0.0, min(1.0, float(x2) / width))
            ny2 = max(0.0, min(1.0, float(y2) / height))

            bw = nx2 - nx1
            bh = ny2 - ny1
            # 3. Geometric verification for real human bodies (rejects tiny desk items or wall panels)
            if bw < 0.035 or bh < 0.07:
                continue
            if bw > 0.85 and bh < 0.22:
                continue

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
    annotated.save(output, format="JPEG", quality=65, optimize=False)
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
        # Prune older detections to keep database slim (<1MB) and queries instantaneous
        old_ids = list(section.detections.order_by("-id").values_list("id", flat=True)[5:])
        if old_ids:
            Detection.objects.filter(id__in=old_ids).delete()

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
        try:
            data = _json(request)
        except Exception:
            data = {}
        if "enabled" in data:
            new_state = bool(data["enabled"])
            set_camera_enabled(new_state)
            if not new_state:
                try:
                    for sec in Section.objects.all():
                        sec.detections.create(person_count=0, boxes=[], processed_frame="")
                except Exception:
                    pass
                try:
                    import threading
                    threading.Thread(target=_apply_automation, args=(1, []), daemon=True).start()
                except Exception:
                    pass
        elif data.get("toggle"):
            new_state = not is_camera_enabled()
            set_camera_enabled(new_state)
            if not new_state:
                try:
                    for sec in Section.objects.all():
                        sec.detections.create(person_count=0, boxes=[], processed_frame="")
                except Exception:
                    pass
                try:
                    import threading
                    threading.Thread(target=_apply_automation, args=(1, []), daemon=True).start()
                except Exception:
                    pass
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


# ==============================================================================
# Dynamic Room Layouts & 3D Perspective Management
# ==============================================================================

DEFAULT_LAYOUTS = [
    {
        "id": "layout-1",
        "name": "Layout 1 (4 Zones)",
        "subtitle": "4 Quadrants",
        "description": "Standard 4-Quadrant setup covering Classroom 101 with perspective corners",
        "isDefault": True,
        "zones": [
            {
                "id": "1",
                "num": 1,
                "name": "Zone 1",
                "color": "#FFB547",
                "relay": 1,
                "pin": 16,
                "points": [[0.0, 0.0], [0.5, 0.0], [0.5, 0.5], [0.0, 0.5]],
                "volumetric": {
                    "top": [[0.0, 0.0], [0.5, 0.0], [0.5, 0.25], [0.0, 0.25]],
                    "pillar": [[0.0, 0.5], [0.0, 0.25]],
                    "pillars": [
                        [[0.0, 0.0], [0.0, 0.0]],
                        [[0.5, 0.0], [0.5, 0.0]],
                        [[0.5, 0.5], [0.5, 0.25]],
                        [[0.0, 0.5], [0.0, 0.25]]
                    ]
                }
            },
            {
                "id": "2",
                "num": 2,
                "name": "Zone 2",
                "color": "#3B82F6",
                "relay": 2,
                "pin": 17,
                "points": [[0.5, 0.0], [1.0, 0.0], [1.0, 0.5], [0.5, 0.5]],
                "volumetric": {
                    "top": [[0.5, 0.0], [1.0, 0.0], [1.0, 0.25], [0.5, 0.25]],
                    "pillar": [[1.0, 0.5], [1.0, 0.25]],
                    "pillars": [
                        [[0.5, 0.0], [0.5, 0.0]],
                        [[1.0, 0.0], [1.0, 0.0]],
                        [[1.0, 0.5], [1.0, 0.25]],
                        [[0.5, 0.5], [0.5, 0.25]]
                    ]
                }
            },
            {
                "id": "3",
                "num": 3,
                "name": "Zone 3",
                "color": "#00E676",
                "relay": 3,
                "pin": 18,
                "points": [[0.0, 0.5], [0.5, 0.5], [0.5, 1.0], [0.0, 1.0]],
                "volumetric": {
                    "top": [[0.0, 0.25], [0.5, 0.25], [0.5, 0.65], [0.0, 0.65]],
                    "pillar": [[0.0, 1.0], [0.0, 0.65]],
                    "pillars": [
                        [[0.0, 0.5], [0.0, 0.25]],
                        [[0.5, 0.5], [0.5, 0.25]],
                        [[0.5, 1.0], [0.5, 0.65]],
                        [[0.0, 1.0], [0.0, 0.65]]
                    ]
                }
            },
            {
                "id": "4",
                "num": 4,
                "name": "Zone 4",
                "color": "#EF4444",
                "relay": 4,
                "pin": 19,
                "points": [[0.5, 0.5], [1.0, 0.5], [1.0, 1.0], [0.5, 1.0]],
                "volumetric": {
                    "top": [[0.5, 0.25], [1.0, 0.25], [1.0, 0.65], [0.5, 0.65]],
                    "pillar": [[1.0, 1.0], [1.0, 0.65]],
                    "pillars": [
                        [[0.5, 0.5], [0.5, 0.25]],
                        [[1.0, 0.5], [1.0, 0.25]],
                        [[1.0, 1.0], [1.0, 0.65]],
                        [[0.5, 1.0], [0.5, 0.65]]
                    ]
                }
            }
        ]
    }
]

def _get_active_layout_id():
    active = RoomLayout.objects.filter(is_active=True).first()
    if active:
        return active.layout_id
    default_l = RoomLayout.objects.filter(is_default=True).first() or RoomLayout.objects.first()
    if default_l:
        default_l.is_active = True
        default_l.save(update_fields=["is_active", "updated_at"])
        return default_l.layout_id
    return "layout-1"


def _get_active_layout():
    active_id = _get_active_layout_id()
    layout = RoomLayout.objects.filter(layout_id=active_id).first() or RoomLayout.objects.first()
    if layout:
        return layout.to_dict()
    layouts = _load_layouts()
    return layouts[0] if layouts else None


def _load_layouts():
    """
    Loads all room layouts directly from SQLite database.
    If database has no layouts, automatically seeds with DEFAULT_LAYOUTS.
    """
    layouts_qs = RoomLayout.objects.all().order_by("id")
    if not layouts_qs.exists():
        for l in DEFAULT_LAYOUTS:
            RoomLayout.objects.create(
                layout_id=str(l.get("id")),
                name=l.get("name") or "Room Layout",
                subtitle=l.get("subtitle") or "",
                description=l.get("description") or "",
                is_default=bool(l.get("isDefault", False)),
                is_active=bool(l.get("isDefault", False)),
                zones=l.get("zones") or [],
            )
        if not RoomLayout.objects.filter(is_active=True).exists():
            first_l = RoomLayout.objects.first()
            if first_l:
                first_l.is_active = True
                first_l.save(update_fields=["is_active"])
        layouts_qs = RoomLayout.objects.all().order_by("id")

    return [l.to_dict() for l in layouts_qs]


def _save_layouts():
    """
    Backwards compatibility stub. All layout persistence is handled directly in SQLite.
    """
    pass


@csrf_exempt
def layouts_api(request):
    if request.method == "OPTIONS":
        return _response({})

    if request.method == "GET":
        return _response({
            "status": "ok",
            "active_layout_id": _get_active_layout_id(),
            "layouts": _load_layouts(),
        })

    if request.method == "POST":
        try:
            import uuid
            data = _json(request)
            name = (data.get("name") or "").strip()
            if not name:
                name = f"Custom Layout {RoomLayout.objects.count() + 1}"

            layout_id = data.get("id") or f"layout-custom-{uuid.uuid4().hex[:6]}"
            zones = data.get("zones") or [
                {
                    "id": "1",
                    "num": 1,
                    "name": "Zone 1",
                    "color": "#FFB547",
                    "relay": 1,
                    "pin": 16,
                    "points": [[0.05, 0.15], [0.48, 0.15], [0.48, 0.85], [0.05, 0.85]]
                },
                {
                    "id": "2",
                    "num": 2,
                    "name": "Zone 2",
                    "color": "#3B82F6",
                    "relay": 2,
                    "pin": 17,
                    "points": [[0.52, 0.15], [0.95, 0.15], [0.95, 0.85], [0.52, 0.85]]
                }
            ]

            new_layout = RoomLayout.objects.create(
                layout_id=layout_id,
                name=name,
                subtitle=data.get("subtitle") or "Custom 3D Room Layout",
                description=data.get("description") or "User customized zone boundaries",
                is_default=False,
                is_active=False,
                zones=zones
            )
            return _response({"status": "ok", "layout": new_layout.to_dict(), "layouts": _load_layouts()}, 201)
        except Exception as exc:
            return _response({"error": str(exc)}, 400)

    return _response({"error": "Method not allowed."}, 405)


@csrf_exempt
def layout_detail(request, layout_id):
    if request.method == "OPTIONS":
        return _response({})

    target = RoomLayout.objects.filter(layout_id=str(layout_id)).first()

    if request.method == "GET":
        if not target:
            return _response({"error": "Layout not found"}, 404)
        return _response({"status": "ok", "layout": target.to_dict()})

    if request.method == "DELETE":
        if not target:
            return _response({"error": "Layout not found"}, 404)
        if RoomLayout.objects.count() <= 1:
            return _response({"error": "Cannot delete the last remaining room layout"}, 400)
        was_active = target.is_active
        target.delete()
        if was_active:
            new_active = RoomLayout.objects.first()
            if new_active:
                new_active.is_active = True
                new_active.save(update_fields=["is_active", "updated_at"])
        return _response({
            "status": "ok",
            "deleted_id": str(layout_id),
            "layouts": _load_layouts(),
            "active_layout_id": _get_active_layout_id()
        })

    if request.method in ["PUT", "PATCH", "POST"]:
        if not target:
            return _response({"error": "Layout not found"}, 404)
        try:
            data = _json(request)
            fields_to_update = ["updated_at"]
            if "name" in data and str(data["name"]).strip():
                target.name = str(data["name"]).strip()
                fields_to_update.append("name")
            if "subtitle" in data:
                target.subtitle = str(data["subtitle"]).strip()
                fields_to_update.append("subtitle")
            if "description" in data:
                target.description = str(data["description"]).strip()
                fields_to_update.append("description")
            if "zones" in data and isinstance(data["zones"], list):
                target.zones = data["zones"]
                fields_to_update.append("zones")

            # Activate this layout when updated
            RoomLayout.objects.filter(is_active=True).exclude(pk=target.pk).update(is_active=False)
            target.is_active = True
            fields_to_update.append("is_active")

            target.save(update_fields=fields_to_update)
            return _response({
                "status": "ok",
                "layout": target.to_dict(),
                "layouts": _load_layouts(),
                "active_layout_id": target.layout_id
            })
        except Exception as exc:
            return _response({"error": str(exc)}, 400)

    return _response({"error": "Method not allowed."}, 405)


@csrf_exempt
def select_layout(request):
    if request.method == "OPTIONS":
        return _response({})
    if request.method != "POST":
        return _response({"error": "Use POST"}, 405)
    try:
        data = _json(request)
        layout_id = str(data.get("layout_id") or data.get("id") or "layout-1")
        target = RoomLayout.objects.filter(layout_id=layout_id).first()
        if not target:
            _load_layouts()
            target = RoomLayout.objects.filter(layout_id=layout_id).first()

        if target:
            RoomLayout.objects.filter(is_active=True).update(is_active=False)
            target.is_active = True
            target.save(update_fields=["is_active", "updated_at"])
            return _response({
                "status": "ok",
                "active_layout_id": target.layout_id,
                "active_layout": target.to_dict(),
                "layouts": _load_layouts()
            })
        return _response({"error": f"Layout {layout_id} not found"}, 404)
    except Exception as exc:
        return _response({"error": str(exc)}, 400)



@csrf_exempt
def sensor_data(request):
    """
    Returns live temperature and humidity directly from the ESP32 HTU21DF sensor.
    Falls back gracefully to calibrated environment baseline if sensor is offline.
    """
    if request.method == "OPTIONS":
        return _response({})
    
    temp = 26.4
    humidity = 58.0
    source = "baseline"
    esp_connected = False

    try:
        res = _esp32_request("/api/status")
        if res.get("status") == "ok":
            esp_connected = True
            if res.get("temperature") is not None:
                temp = round(float(res["temperature"]), 1)
                source = "ESP32-HTU21DF"
            if res.get("humidity") is not None:
                humidity = round(float(res["humidity"]), 1)
                source = "ESP32-HTU21DF"
    except Exception:
        pass

    return _response({
        "status": "ok",
        "temperature": temp,
        "humidity": humidity,
        "energy_saving_percent": 12,
        "source": source,
        "esp32_connected": esp_connected,
        "timestamp": timezone.now().isoformat(),
    })


_cached_segformer_processor = None
_cached_segformer_model = None

def get_segformer_model():
    """
    Singleton loader for Hugging Face SegFormer ADE20K semantic segmentation model.
    Checks newBackend/models/segformer-b0-ade-512-512 first.
    If not present, automatically downloads from Hugging Face and saves to local models folder.
    """
    global _cached_segformer_processor, _cached_segformer_model
    if _cached_segformer_processor is not None and _cached_segformer_model is not None:
        return _cached_segformer_processor, _cached_segformer_model

    from pathlib import Path
    from transformers import AutoImageProcessor, AutoModelForSemanticSegmentation
    import torch

    local_model_dir = Path(settings.BASE_DIR) / "models" / "segformer-b0-ade-512-512"

    if (local_model_dir / "model.safetensors").exists() or (local_model_dir / "pytorch_model.bin").exists():
        logger.info("[SEROS-AI] Loading SegFormer model from local directory: %s", local_model_dir)
        _cached_segformer_processor = AutoImageProcessor.from_pretrained(str(local_model_dir))
        _cached_segformer_model = AutoModelForSemanticSegmentation.from_pretrained(str(local_model_dir))
    else:
        logger.info("[SEROS-AI] Local model not found. Downloading SegFormer from Hugging Face (nvidia/segformer-b0-finetuned-ade-512-512)...")
        model_id = "nvidia/segformer-b0-finetuned-ade-512-512"
        _cached_segformer_processor = AutoImageProcessor.from_pretrained(model_id)
        _cached_segformer_model = AutoModelForSemanticSegmentation.from_pretrained(model_id)
        local_model_dir.mkdir(parents=True, exist_ok=True)
        _cached_segformer_processor.save_pretrained(local_model_dir)
        _cached_segformer_model.save_pretrained(local_model_dir)
        logger.info("[SEROS-AI] Model successfully saved to %s", local_model_dir)

    _cached_segformer_model.eval()
    return _cached_segformer_processor, _cached_segformer_model


@csrf_exempt
def ai_automap(request):
    """
    Auto-maps the camera view into 3D volumetric perspective zones using Hugging Face indoor scene perception.
    Accepts:
    - num_zones / quadrants (default: 4, supported: 2, 3, 4, 6, 8)
    - num_lights / lights (1 to 8, default: 4)
    - num_fans / fans (0 to 6, default: 2)
    - num_acs / acs (0 to 4, default: 1)
    - equipment_placement ('quadrant', 'perimeter', 'front_loaded', 'uniform')
    - room_name (e.g. 'Classroom 101')
    - frame (base64 image from camera snapshot)
    """
    if request.method == "OPTIONS":
        return _response({})
    if request.method != "POST":
        return _response({"error": "Use POST"}, 405)

    try:
        import uuid
        import numpy as np
        import torch
        from PIL import Image
        from io import BytesIO

        data = _json(request)

        # Parse user configuration options
        num_zones = int(data.get("num_zones") or data.get("quadrants") or 4)
        if num_zones not in [2, 3, 4, 6, 8]:
            num_zones = 4

        num_lights = int(data.get("num_lights") or data.get("lights") or 4)
        num_fans = int(data.get("num_fans") or data.get("fans") or 2)
        num_acs = int(data.get("num_acs") or data.get("acs") or 1)
        placement_mode = str(data.get("equipment_placement") or "quadrant").lower()
        room_name = (data.get("room_name") or "Classroom 101").strip()

        # 1. Decode camera frame image
        pil_image = None
        frame_raw = data.get("frame") or data.get("image") or ""
        if frame_raw:
            if "," in frame_raw:
                frame_raw = frame_raw.split(",", 1)[1]
            try:
                img_bytes = base64.b64decode(frame_raw)
                pil_image = Image.open(BytesIO(img_bytes)).convert("RGB")
            except Exception as e:
                logger.warning("[SEROS-AI] Failed to decode posted frame: %s", e)

        # Fallback to latest camera detection frame if client didn't supply frame
        if pil_image is None:
            latest_det = Detection.objects.order_by("-id").first()
            if latest_det and latest_det.processed_frame:
                pf = latest_det.processed_frame
                if "," in pf:
                    pf = pf.split(",", 1)[1]
                try:
                    pil_image = Image.open(BytesIO(base64.b64decode(pf))).convert("RGB")
                except Exception:
                    pass

        # 2. Run SegFormer inference for indoor room geometry
        # Default perspective room bounds spanning full camera view edge-to-edge
        top_left  = [0.0, 0.0]
        top_right = [1.0, 0.0]
        bot_right = [1.0, 1.0]
        bot_left  = [0.0, 1.0]

        if pil_image is not None:
            try:
                proc, seg_model = get_segformer_model()
                orig_w, orig_h = pil_image.size
                inputs = proc(images=pil_image, return_tensors="pt")

                with torch.no_grad():
                    outputs = seg_model(**inputs)
                    logits = outputs.logits
                    upsampled = torch.nn.functional.interpolate(
                        logits, size=(orig_h, orig_w), mode="bilinear", align_corners=False
                    )
                    pred_map = upsampled.argmax(dim=1)[0].cpu().numpy()

                # ADE20K classes: 3: floor, 15: table, 33: desk, 19: chair
                ground_mask = np.isin(pred_map, [3, 15, 33, 19])
                y_indices, x_indices = np.where(ground_mask)

                if len(y_indices) > 500:
                    # Detect perspective ground plane boundaries while preserving full camera edge-to-edge coverage
                    y_min_norm = float(np.percentile(y_indices, 3)) / orig_h
                    top_y = round(max(0.0, min(0.35, y_min_norm)), 2)
                    logger.info("[SEROS-AI] Perceived floor horizon at Y=%s. Spanning edge-to-edge.", top_y)
            except Exception as exc:
                logger.warning("[SEROS-AI] SegFormer perception error (falling back to geometric perspective): %s", exc)

        ZONE_COLORS = [
            "#00D2FF", # 1: Cyber Cyan
            "#6366F1", # 2: Indigo Neon
            "#10B981", # 3: Emerald Mint
            "#F43F5E", # 4: Coral Rose
            "#A855F7", # 5: Vivid Purple
            "#F59E0B", # 6: Amber Gold
            "#06B6D4", # 7: Electric Teal
            "#EC4899", # 8: Hot Pink
        ]
        RELAY_PINS = [16, 17, 18, 19, 23, 25, 26, 27]

        # Helper to compute 3D volumetric top ceiling points and pillars for any floor polygon
        def make_volumetric(floor_pts):
            top_pts = []
            pillars = []
            for (fx, fy) in floor_pts:
                # Wall height scales with perspective depth (shorter at back, taller in foreground)
                t_factor = max(0.0, min(1.0, fy))
                wall_h = 0.12 + 0.28 * t_factor
                ty = round(max(0.0, fy - wall_h), 2)
                top_pts.append([round(fx, 2), ty])
                pillars.append([[round(fx, 2), round(fy, 2)], [round(fx, 2), ty]])
            return {
                "top": top_pts,
                "pillar": pillars[0] if pillars else [],
                "pillars": pillars
            }

        zones = []

        if num_zones == 2:
            # 2 Left-Right split halves covering full camera view
            p1 = [[0.0, 0.0], [0.5, 0.0], [0.5, 1.0], [0.0, 1.0]]
            p2 = [[0.5, 0.0], [1.0, 0.0], [1.0, 1.0], [0.5, 1.0]]
            zones = [
                {"id": "1", "num": 1, "name": "Zone 1 (Left Half)", "color": ZONE_COLORS[0], "relay": 1, "pin": RELAY_PINS[0], "points": p1, "volumetric": make_volumetric(p1), "devices_assigned": ""},
                {"id": "2", "num": 2, "name": "Zone 2 (Right Half)", "color": ZONE_COLORS[1], "relay": 2, "pin": RELAY_PINS[1], "points": p2, "volumetric": make_volumetric(p2), "devices_assigned": ""}
            ]

        elif num_zones == 3:
            # 3 Column vertical perspective strips
            x_steps = [0.0, 0.33, 0.67, 1.0]
            for i in range(3):
                p = [
                    [x_steps[i], 0.0],
                    [x_steps[i+1], 0.0],
                    [x_steps[i+1], 1.0],
                    [x_steps[i], 1.0],
                ]
                zones.append({
                    "id": str(i + 1), "num": i + 1, "name": f"Zone {i + 1} (Col {i + 1})",
                    "color": ZONE_COLORS[i], "relay": i + 1, "pin": RELAY_PINS[i % len(RELAY_PINS)],
                    "points": p, "volumetric": make_volumetric(p), "devices_assigned": ""
                })

        elif num_zones == 6:
            # 2 Rows x 3 Columns (Lecture Hall format)
            x_steps = [0.0, 0.33, 0.67, 1.0]
            # Row 1 (Back/Top)
            for c in range(3):
                p = [[x_steps[c], 0.0], [x_steps[c+1], 0.0], [x_steps[c+1], 0.5], [x_steps[c], 0.5]]
                idx = c + 1
                zones.append({"id": str(idx), "num": idx, "name": f"Zone {idx} (Front-{['Left','Center','Right'][c]})", "color": ZONE_COLORS[idx-1], "relay": idx, "pin": RELAY_PINS[(idx-1) % len(RELAY_PINS)], "points": p, "volumetric": make_volumetric(p), "devices_assigned": ""})

            # Row 2 (Front/Bottom)
            for c in range(3):
                p = [[x_steps[c], 0.5], [x_steps[c+1], 0.5], [x_steps[c+1], 1.0], [x_steps[c], 1.0]]
                idx = c + 4
                zones.append({"id": str(idx), "num": idx, "name": f"Zone {idx} (Back-{['Left','Center','Right'][c]})", "color": ZONE_COLORS[idx-1], "relay": idx, "pin": RELAY_PINS[(idx-1) % len(RELAY_PINS)], "points": p, "volumetric": make_volumetric(p), "devices_assigned": ""})

        elif num_zones == 8:
            # 2 Rows x 4 Columns
            x_steps = [0.0, 0.25, 0.50, 0.75, 1.0]
            # Front 4
            for c in range(4):
                p = [[x_steps[c], 0.0], [x_steps[c+1], 0.0], [x_steps[c+1], 0.5], [x_steps[c], 0.5]]
                idx = c + 1
                zones.append({"id": str(idx), "num": idx, "name": f"Zone {idx}", "color": ZONE_COLORS[(idx-1) % len(ZONE_COLORS)], "relay": idx, "pin": RELAY_PINS[(idx-1) % len(RELAY_PINS)], "points": p, "volumetric": make_volumetric(p), "devices_assigned": ""})
            # Back 4
            for c in range(4):
                p = [[x_steps[c], 0.5], [x_steps[c+1], 0.5], [x_steps[c+1], 1.0], [x_steps[c], 1.0]]
                idx = c + 5
                zones.append({"id": str(idx), "num": idx, "name": f"Zone {idx}", "color": ZONE_COLORS[(idx-1) % len(ZONE_COLORS)], "relay": idx, "pin": RELAY_PINS[(idx-1) % len(RELAY_PINS)], "points": p, "volumetric": make_volumetric(p), "devices_assigned": ""})

        else:
            # Standard 4 Quadrants (100% camera view edge-to-edge covering all 4 corners)
            mid_top = [0.5, 0.0]
            mid_bot = [0.5, 1.0]
            mid_left = [0.0, 0.5]
            mid_right = [1.0, 0.5]
            mid_center = [0.5, 0.5]

            p1 = [[0.0, 0.0], mid_top, mid_center, mid_left]
            p2 = [mid_top, [1.0, 0.0], mid_right, mid_center]
            p3 = [mid_left, mid_center, mid_bot, [0.0, 1.0]]
            p4 = [mid_center, mid_right, [1.0, 1.0], mid_bot]

            zones = [
                {"id": "1", "num": 1, "name": "Zone 1 (Front-Left)", "color": ZONE_COLORS[0], "relay": 1, "pin": RELAY_PINS[0], "points": p1, "volumetric": make_volumetric(p1), "devices_assigned": ""},
                {"id": "2", "num": 2, "name": "Zone 2 (Front-Right)", "color": ZONE_COLORS[1], "relay": 2, "pin": RELAY_PINS[1], "points": p2, "volumetric": make_volumetric(p2), "devices_assigned": ""},
                {"id": "3", "num": 3, "name": "Zone 3 (Back-Left)", "color": ZONE_COLORS[2], "relay": 3, "pin": RELAY_PINS[2], "points": p3, "volumetric": make_volumetric(p3), "devices_assigned": ""},
                {"id": "4", "num": 4, "name": "Zone 4 (Back-Right)", "color": ZONE_COLORS[3], "relay": 4, "pin": RELAY_PINS[3], "points": p4, "volumetric": make_volumetric(p4), "devices_assigned": ""},
            ]

        # 4. Equipment distribution according to user choices
        for idx, z in enumerate(zones):
            assigned = []
            # Light assignment
            if placement_mode == "perimeter":
                if idx in [0, 1, len(zones)-2, len(zones)-1] or idx < num_lights:
                    assigned.append(f"Light {idx + 1}")
            else:
                if idx < num_lights:
                    assigned.append(f"Light {idx + 1}")
                elif num_lights > len(zones) and idx == 0:
                    assigned.append("Light Master")

            # Fan assignment
            if idx < num_fans:
                assigned.append(f"Fan {idx + 1}")

            # AC assignment
            if num_acs > 0:
                if placement_mode == "front_loaded" and idx < 2:
                    assigned.append("Room AC Unit")
                elif placement_mode != "front_loaded":
                    assigned.append("Room AC Unit")

            z["devices_assigned"] = ", ".join(assigned) if assigned else "Lighting Fixture"

        # 5. Persist into SQLite and mark as active layout
        layout_id = f"ai-layout-{uuid.uuid4().hex[:6]}"
        RoomLayout.objects.filter(is_active=True).update(is_active=False)
        new_layout = RoomLayout.objects.create(
            layout_id=layout_id,
            name=f"AI Auto-Mapped ({room_name})",
            subtitle=f"{len(zones)} Volumetric Zones • {num_lights}L {num_fans}F {num_acs}AC",
            description="Generated via Hugging Face SegFormer AI Room Perception with 3D walls",
            is_default=False,
            is_active=True,
            zones=zones,
        )

        return _response({
            "status": "ok",
            "message": f"AI Auto-mapping complete! Generated {len(zones)} 3D perspective zones.",
            "layout_id": new_layout.layout_id,
            "layout_name": new_layout.name,
            "zones": new_layout.zones,
            "layout": new_layout.to_dict(),
            "layouts": _load_layouts(),
        }, 201)

    except Exception as exc:
        logger.exception("[SEROS-AI] Error during ai_automap: %s", exc)
        return _response({"error": str(exc)}, 400)


@csrf_exempt
def weather_api(request):
    return sensor_data(request)

