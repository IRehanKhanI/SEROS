from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import urllib.request
import urllib.error
import traceback
from google import genai
from google.genai import types
import os
from dotenv import load_dotenv
from pathlib import Path

# Explicitly point to the .env file in the root directory
env_path = Path(__file__).resolve().parent.parent / '.env'

def get_gemini_client():
    # override=True forces it to use the .env file even if Windows has a broken variable cached
    load_dotenv(dotenv_path=env_path, override=True)
    key = os.getenv("GEMINI_API_KEY")
    if key:
        key = key.strip(' "\'')
    else:
        print("CRITICAL: GEMINI_API_KEY IS NONE")
    return genai.Client(api_key=key)

@csrf_exempt
def ping(request):
    return JsonResponse({"status": "ok"})

@csrf_exempt
def generate_prediction(request):
    if request.method == "POST":
        try:
            body = json.loads(request.body)
            history = body.get("history", [])
            
            prompt = f"""Context: A smart institution's electricity usage (kWh) over the last {len(history)} days: {history}.
Task: Act as an expert energy analyst. Analyze the trend, weekly cycles, and provide a realistic forecast for the next 7 days in kWh.
Then, calculate the estimated daily cost using this tariff:
- 0 to 100 kWh: Rs. 3.75/unit
- 101 to 200 kWh: Rs. 4.60/unit
- 201 to 400 kWh: Rs. 5.30/unit
- Above 400 kWh: Rs. 5.75/unit

Requirement: Return ONLY a JSON object with EXACTLY this structure:
{{
  "predictions": [
    {{"kWh": 45.2, "cost": 169.5}},
    ... (must have exactly 7 daily items)
  ],
  "total_cost": 1186.50
}}"""

            # Use Gemini with JSON mode enforcement
            client = get_gemini_client()
            response = client.models.generate_content(
                model='gemini-3-flash-preview',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                )
            )
            
            ai_response = json.loads(response.text)
            predictions = ai_response.get("predictions", [])
            total_cost = ai_response.get("total_cost", 0.0)
            
            return JsonResponse({
                "status": "success", 
                "predictions": predictions,
                "total_cost": total_cost
            })

        except Exception as e:
            traceback.print_exc()
            return JsonResponse({"status": "error", "message": str(e)}, status=500)
            
    return JsonResponse({"error": "POST method required"}, status=405)

@csrf_exempt
def smart_greeting(request):
    if request.method == "GET":
        try:
            client = get_gemini_client()
            response = client.models.generate_content(
                model='gemini-3-flash-preview',
                contents="The user is currently being watched by a smart AI camera in a smart energy-optimized room. Give a 1-sentence witty, futuristic greeting."
            )
            return JsonResponse({"status": "success", "greeting": response.text.strip()})

        except Exception as e:
            traceback.print_exc()
            return JsonResponse({"status": "error", "message": f"Gemini connection error: {str(e)}"}, status=500)

    return JsonResponse({"error": "GET method required"}, status=405)


from django.core.cache import cache

@csrf_exempt
def current_weather(request):
    if request.method == "GET":
        key = os.getenv("weatherAPI")
        if not key:
            return JsonResponse({"temperature": 32.0, "humidity": 55.0, "error": "No weatherAPI key in .env"})
        
        weather_data = cache.get("weather_data")
        if not weather_data:
            try:
                # Query weatherAPI for live data (using auto:ip or Mumbai as fallback)
                url = f"http://api.weatherapi.com/v1/current.json?key={key}&q=auto:ip"
                req = urllib.request.Request(url)
                with urllib.request.urlopen(req) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode())
                        weather_data = {
                            "temperature": data["current"]["temp_c"],
                            "humidity": data["current"]["humidity"]
                        }
                        # Cache for 10 minutes (600 seconds) to avoid rate limits
                        cache.set("weather_data", weather_data, 600)
            except Exception as e:
                pass
                
        if not weather_data:
            weather_data = {"temperature": 32.0, "humidity": 55.0}
            
        return JsonResponse(weather_data)
        
    return JsonResponse({"error": "GET method required"}, status=405)

@csrf_exempt
def generate_chat(request):
    if request.method == "POST":
        try:
            body = json.loads(request.body)
            user_prompt = body.get("prompt", "")
            
            system_prompt = "You are Gemini, an AI energy assistant for a smart institution called SEROS. Keep answers short, witty, and related to energy conservation, IoT, and analytics."
            
            client = get_gemini_client()
            response = client.models.generate_content(
                model='gemini-3-flash-preview',
                contents=f"{system_prompt}\nUser says: {user_prompt}"
            )
            
            return JsonResponse({"status": "success", "response": response.text.strip()})

        except Exception as e:
            traceback.print_exc()
            return JsonResponse({"status": "error", "message": f"Gemini connection error: {str(e)}"}, status=500)

    return JsonResponse({"error": "POST method required"}, status=405)


import random
import base64
import numpy as np
import cv2
from ultralytics import YOLO
import serial

try:
    # Use small model instead of nano for much higher accuracy
    yolo_model = YOLO('yolov8s.pt')
    print("YOLO Loaded Successfully in views.py")
except Exception as e:
    print(f"FAILED TO LOAD YOLO: {e}")
    yolo_model = None

# ---- ARDUINO IOT INTEGRATION ----
last_sent_cmd = None
try:
    import serial
    import time
    arduino_serial = serial.Serial('COM6', 9600, timeout=1)
    # Wait for the Arduino bootloader to finish resetting the board
    time.sleep(2) 
    print("✅ Successfully connected to Arduino on COM6")
except Exception as e:
    print(f"⚠ FAILED TO CONNECT TO ARDUINO ON COM6: {e}")
    arduino_serial = None
# ---------------------------------

@csrf_exempt
def detect_occupancy(request):
    """
    Real AI Endpoint for IoT Integration.
    Receives base64 image from React Native phone camera, runs YOLOv8 detection, 
    and returns real-time occupancy coordinates for event-driven Fan/AC control.
    """
    if request.method == "POST":
        try:
            body = json.loads(request.body)
            image_b64 = body.get("image", None)
            
            if not image_b64:
                return JsonResponse({"error": "No image provided"}, status=400)
            
            if ',' in image_b64:
                image_b64 = image_b64.split(',')[1]
            
            img_bytes = base64.b64decode(image_b64)
            np_arr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            
            if img is None:
                print("Failed to decode image from base64")
                return JsonResponse({"error": "Failed to decode image"}, status=400)
            
            people_count = 0
            position = "-"
            fan_left = False
            fan_right = False
            persons_coords = []
            
            if yolo_model is None:
                print("YOLO MODEL IS NONE - CANNOT DETECT")
                return JsonResponse({"error": "AI Model not loaded on backend"}, status=500)
            
            # Predict with higher accuracy parameters
            results = yolo_model(img, classes=[0], conf=0.6, imgsz=640, verbose=False)
            img_width = img.shape[1]
            img_height = img.shape[0]
            
            for r in results:
                for box in r.boxes:
                    people_count += 1
                    x1 = box.xyxy[0][0].item()
                    y1 = box.xyxy[0][1].item()
                    x2 = box.xyxy[0][2].item()
                    y2 = box.xyxy[0][3].item()
                    
                    center_x = (x1 + x2) / 2
                    center_y = (y1 + y2) / 2
                    
                    # Normalize coordinates (0.0 to 1.0) for easier frontend handling
                    norm_x = round(center_x / img_width, 3)
                    norm_y = round(center_y / img_height, 3)
                    
                    persons_coords.append({"x": norm_x, "y": norm_y})
                    
                    if center_x < img_width / 2:
                        fan_left = True
                        if position == "-": position = "left"
                        elif position == "right": position = "both"
                    else:
                        fan_right = True
                        if position == "-": position = "right"
                        elif position == "left": position = "both"
            
            # --- SEND IOT COMMAND TO ARDUINO ---
            global last_sent_cmd
            cmd_to_send = b"off\n" # Default to OFF if nobody
            
            if people_count > 0:
                if position == "left":
                    cmd_to_send = b"left\n"
                elif position == "right":
                    cmd_to_send = b"right\n"
                elif position == "both":
                    cmd_to_send = b"both\n"
            
            if cmd_to_send != last_sent_cmd:
                print(f"📊 STATE CHANGE: {last_sent_cmd} -> {cmd_to_send.decode().strip()}")
                # --- DB LOGGING (State Change) ---
                try:
                    from .models import Room, Device, DeviceUsageSession
                    from django.utils import timezone
                    
                    room, _ = Room.objects.get_or_create(name="Smart Room")
                    
                    # Close previous sessions
                    open_sessions = DeviceUsageSession.objects.filter(end_time__isnull=True)
                    now = timezone.now()
                    closed_count = 0
                    for session in open_sessions:
                        session.end_time = now
                        duration_delta = session.end_time - session.start_time
                        session.duration_seconds = duration_delta.total_seconds()
                        power_kw = session.device.power_rating_watts / 1000.0
                        session.energy_consumed_kwh = (session.duration_seconds / 3600.0) * power_kw
                        session.save()
                        closed_count += 1
                        print(f"  ✅ CLOSED session: {session.device.name} | {session.duration_seconds:.1f}s | {session.energy_consumed_kwh:.6f} kWh")
                    
                    # Open new sessions
                    devices_to_turn_on = []
                    if cmd_to_send in [b"left\n", b"both\n"]:
                        dev, _ = Device.objects.get_or_create(name="Left Fan", room=room, defaults={"device_type": "fan", "power_rating_watts": 60.0})
                        devices_to_turn_on.append(dev)
                    if cmd_to_send in [b"right\n", b"both\n"]:
                        dev, _ = Device.objects.get_or_create(name="Right Fan", room=room, defaults={"device_type": "fan", "power_rating_watts": 60.0})
                        devices_to_turn_on.append(dev)
                    
                    for dev in devices_to_turn_on:
                        DeviceUsageSession.objects.create(device=dev)
                        print(f"  🔴 OPENED new session: {dev.name}")
                    
                    total_sessions = DeviceUsageSession.objects.count()
                    print(f"  📦 Total sessions in SQLite: {total_sessions}")
                        
                except Exception as db_err:
                    import traceback as tb
                    print(f"❌ DB Log Error: {db_err}")
                    tb.print_exc()

                # Prevent spamming the Arduino port (only send if command changes)
                if arduino_serial and arduino_serial.is_open:
                    try:
                        arduino_serial.write(cmd_to_send)
                        print(f"IOT -> Sent Arduino Command: {cmd_to_send.decode().strip()}")
                    except Exception as serial_err:
                        print(f"Arduino Serial Write Error: {serial_err}")
                
                last_sent_cmd = cmd_to_send
            # ------------------------------------

            # Calculate fan speed based on crowd density
            fan_speed = 0  # 0=off, 1=low, 2=medium, 3=high
            if people_count == 1:
                fan_speed = 1
            elif people_count == 2:
                fan_speed = 2
            elif people_count >= 3:
                fan_speed = 3

            return JsonResponse({
                "status": "success",
                "people": people_count,
                "position": position,
                "fan_left": fan_left,
                "fan_right": fan_right,
                "fan_speed": fan_speed,
                "persons": persons_coords,
                "img_shape": f"{img_width}x{img_height}"
            })

        except Exception as e:
            traceback.print_exc()
            return JsonResponse({"status": "error", "message": str(e)}, status=500)
            
    return JsonResponse({"error": "POST method required"}, status=405)

def get_analytics_data(request):
    try:
        from .models import DeviceUsageSession, EnergyLog
        from django.db.models import Sum
        from django.utils import timezone
        
        # 1. Active devices (currently running - only when camera is sending data)
        open_sessions = DeviceUsageSession.objects.filter(end_time__isnull=True)
        active_devices = [{"name": s.device.name, "power_watts": s.device.power_rating_watts, "source": "live"} for s in open_sessions]
        live_power_draw = sum(s.device.power_rating_watts for s in open_sessions)
        
        # 2. Total energy consumed from LIVE device sessions
        closed_sessions = DeviceUsageSession.objects.filter(end_time__isnull=False)
        live_kwh = sum(s.energy_consumed_kwh for s in closed_sessions)
        
        # 3. Device efficiency breakdown with proper labels (4 devices: 2 fans + 2 lights)
        device_breakdown = []
        unique_devices = set([s.device for s in closed_sessions])
        for dev in unique_devices:
            dev_kwh = sum(s.energy_consumed_kwh for s in closed_sessions if s.device == dev)
            device_breakdown.append({
                "name": dev.name,
                "kwh": round(dev_kwh, 6),
                "source": "live"
            })
        
        # 4. Savings Calculation
        first_session = DeviceUsageSession.objects.all().order_by('start_time').first()
        hours_unused = 0.0
        rs_saved = 0.0
        watts_saved = 180.0  # 2 fans (60W each) + 2 lights (30W each) = 180W total
        electricity_rate = 5.0
        
        if first_session:
            total_seconds_tracked = (timezone.now() - first_session.start_time).total_seconds()
            total_hours_tracked = total_seconds_tracked / 3600.0
            total_device_hours = sum(s.duration_seconds for s in closed_sessions) / 3600.0
            room_active_hours = total_device_hours / max(1, len(unique_devices))
            hours_unused = max(0, total_hours_tracked - room_active_hours)
            kwh_saved = (watts_saved / 1000.0) * hours_unused
            rs_saved = kwh_saved * electricity_rate
        
        # 5. --- DEMO SCALING (Reduced for realism) ---
        DEMO_MULTIPLIER = 60.0  # 1 second = 1 minute (reduced from 3600)
        
        BASE_KWH = 12.50  # Realistic for a small room per day
        BASE_UNUSED_HOURS = 8.5
        BASE_SAVED_RS = BASE_UNUSED_HOURS * (watts_saved / 1000.0) * electricity_rate
        
        scaled_kwh = round(BASE_KWH + (live_kwh * DEMO_MULTIPLIER), 2)
        scaled_cost = round(scaled_kwh * electricity_rate, 2)
        scaled_unused = round(BASE_UNUSED_HOURS + (hours_unused * DEMO_MULTIPLIER), 2)
        scaled_saved_rs = round(BASE_SAVED_RS + (rs_saved * DEMO_MULTIPLIER), 2)
        
        # 6. Device breakdown (4 devices: Left Fan, Right Fan, Left Light, Right Light)
        if not device_breakdown:
            device_breakdown = [
                {"name": "Left Fan", "kwh": round(BASE_KWH * 0.30, 2), "source": "baseline", "watts": 60},
                {"name": "Right Fan", "kwh": round(BASE_KWH * 0.30, 2), "source": "baseline", "watts": 60},
                {"name": "Left Light", "kwh": round(BASE_KWH * 0.20, 2), "source": "baseline", "watts": 30},
                {"name": "Right Light", "kwh": round(BASE_KWH * 0.20, 2), "source": "baseline", "watts": 30},
            ]
        else:
            # Add lights to the breakdown (they are always on when relay is ON)
            fan_names = [d["name"] for d in device_breakdown]
            for dev in device_breakdown:
                dev["kwh"] = round((BASE_KWH * 0.25 / len(device_breakdown)) + (dev["kwh"] * DEMO_MULTIPLIER), 2)
                dev["source"] = "live"
            if "Left Light" not in fan_names:
                device_breakdown.append({"name": "Left Light", "kwh": round(BASE_KWH * 0.15, 2), "source": "baseline", "watts": 30})
            if "Right Light" not in fan_names:
                device_breakdown.append({"name": "Right Light", "kwh": round(BASE_KWH * 0.15, 2), "source": "baseline", "watts": 30})
        
        # 7. Daily chart data (realistic for a small room)
        scaled_daily = [8.20, 9.45, 7.80, 10.15, 9.60, 4.50, round(scaled_kwh, 2)]
        
        # 8. Historical data from EnergyLog (Kaggle dataset)
        hist_total = EnergyLog.objects.aggregate(total=Sum('consumption_kwh'))['total'] or 0
        
        return JsonResponse({
            "status": "success",
            "active_devices": active_devices,
            "live_power_draw_watts": live_power_draw,
            "total_kwh_consumed": scaled_kwh,
            "total_cost_rs": scaled_cost,
            "rs_saved": scaled_saved_rs,
            "hours_unused": scaled_unused,
            "device_breakdown": device_breakdown,
            "daily_kwh": scaled_daily,
            "hist_total_kwh": round(hist_total, 2),
            "data_sources": {
                "live": "Camera AI + Arduino (real-time)",
                "baseline": "Scaled baseline for demo",
                "kaggle": f"Historical dataset ({round(hist_total, 0)} kWh over 90 days)"
            }
        })
    except Exception as e:
        traceback.print_exc()
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


def get_historical_usage(request):
    """Return last 30 days of seeded historical data for the dashboard charts."""
    try:
        from .models import EnergyLog
        from django.utils import timezone
        from datetime import timedelta
        
        thirty_days_ago = timezone.now() - timedelta(days=30)
        logs = EnergyLog.objects.filter(timestamp__gte=thirty_days_ago).order_by('timestamp')
        
        # Aggregate by day
        daily = {}
        for log in logs:
            day_key = log.timestamp.strftime('%Y-%m-%d')
            if day_key not in daily:
                daily[day_key] = {"kwh": 0, "temp_sum": 0, "humidity_sum": 0, "occ_sum": 0, "count": 0}
            daily[day_key]["kwh"] += log.consumption_kwh
            daily[day_key]["temp_sum"] += log.temperature_c
            daily[day_key]["humidity_sum"] += log.humidity_pct
            daily[day_key]["occ_sum"] += log.occupancy
            daily[day_key]["count"] += 1
        
        result = []
        for day, data in sorted(daily.items()):
            result.append({
                "date": day,
                "kwh": round(data["kwh"], 2),
                "avg_temp": round(data["temp_sum"] / data["count"], 1),
                "avg_humidity": round(data["humidity_sum"] / data["count"], 1),
                "avg_occupancy": round(data["occ_sum"] / data["count"], 1),
            })
        
        return JsonResponse({
            "status": "success",
            "days": len(result),
            "total_kwh": round(sum(d["kwh"] for d in result), 2),
            "data": result,
        })
    except Exception as e:
        traceback.print_exc()
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


@csrf_exempt
def ml_predict(request):
    """Predict next 7 days using the trained ML model (RandomForest)."""
    try:
        import pickle
        import numpy as np
        from pathlib import Path
        from datetime import datetime, timedelta
        
        model_path = Path(__file__).resolve().parent.parent / 'ml_model.pkl'
        if not model_path.exists():
            return JsonResponse({"status": "error", "message": "ML model not trained yet. Run train_model.py first."}, status=400)
        
        with open(model_path, 'rb') as f:
            model_data = pickle.load(f)
            
        model = model_data['model']
        le = model_data['encoder']
        means = model_data['means']
        
        # Parse optional live data from request
        body = {}
        if request.method == "POST" and request.body:
            body = json.loads(request.body)
        
        current_temp = body.get("temperature", 32.0)
        
        now = datetime.now()
        predictions = []
        
        future_var1 = means['var1']
        future_pressure = means['pressure']
        future_windspeed = means['windspeed']
        # Default 'var2' category from the encoder classes (e.g. 'A')
        future_var2_encoded = le.transform([le.classes_[0]])[0]
        
        for day_offset in range(1, 8):
            future = now + timedelta(days=day_offset)
            day_of_week = future.weekday()
            is_weekend = 1 if day_of_week >= 5 else 0
            
            daily_kwh = 0
            hourly = []
            for hour in range(24):
                # Vary temperature through the day
                import math
                temp = current_temp + 5 * math.sin(2 * math.pi * (hour - 6) / 24)
                
                features = np.array([[hour, day_of_week, is_weekend, temp, future_var1, future_pressure, future_windspeed, future_var2_encoded]])
                pred = model.predict(features)[0]
                daily_kwh += pred
                hourly.append(round(pred, 2))
            
            # Calculate cost using tariff slabs
            cost = 0
            if daily_kwh <= 100:
                cost = daily_kwh * 3.75
            elif daily_kwh <= 200:
                cost = 100 * 3.75 + (daily_kwh - 100) * 4.60
            elif daily_kwh <= 400:
                cost = 100 * 3.75 + 100 * 4.60 + (daily_kwh - 200) * 5.30
            else:
                cost = 100 * 3.75 + 100 * 4.60 + 200 * 5.30 + (daily_kwh - 400) * 5.75
            
            predictions.append({
                "day_index": day_offset,
                "date": future.strftime('%Y-%m-%d'),
                "day_name": future.strftime('%A'),
                "predicted_kwh": round(daily_kwh, 2),
                "estimated_cost": round(cost, 2),
            })
        
        total_kwh = sum(p["predicted_kwh"] for p in predictions)
        total_cost = sum(p["estimated_cost"] for p in predictions)
        
        return JsonResponse({
            "status": "success",
            "model": "RandomForest (scikit-learn)",
            "predictions": predictions,
            "total_kwh": round(total_kwh, 2),
            "total_cost": round(total_cost, 2),
        })
    except Exception as e:
        traceback.print_exc()
        return JsonResponse({"status": "error", "message": str(e)}, status=500)
