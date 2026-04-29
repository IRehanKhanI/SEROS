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
    yolo_model = YOLO('yolov8n.pt')
    print("YOLO Loaded Successfully in views.py")
except Exception as e:
    print(f"FAILED TO LOAD YOLO: {e}")
    yolo_model = None

# ---- ARDUINO IOT INTEGRATION ----
last_sent_cmd = None
try:
    arduino_serial = serial.Serial('COM5', 9600, timeout=1)
    print("✅ Successfully connected to Arduino on COM5")
except Exception as e:
    print(f"⚠ FAILED TO CONNECT TO ARDUINO ON COM5: {e}")
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
            
            # Predict
            results = yolo_model(img, classes=[0], verbose=False)
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
            
            # Prevent spamming the Arduino port (only send if command changes)
            if arduino_serial and arduino_serial.is_open and cmd_to_send != last_sent_cmd:
                try:
                    arduino_serial.write(cmd_to_send)
                    last_sent_cmd = cmd_to_send
                    print(f"IOT -> Sent Arduino Command: {cmd_to_send.decode().strip()}")
                except Exception as serial_err:
                    print(f"Arduino Serial Write Error: {serial_err}")
            # ------------------------------------

            return JsonResponse({
                "status": "success",
                "people": people_count,
                "position": position,
                "fan_left": fan_left,
                "fan_right": fan_right,
                "persons": persons_coords,
                "img_shape": f"{img_width}x{img_height}"
            })

        except Exception as e:
            traceback.print_exc()
            return JsonResponse({"status": "error", "message": str(e)}, status=500)
            
    return JsonResponse({"error": "POST method required"}, status=405)

