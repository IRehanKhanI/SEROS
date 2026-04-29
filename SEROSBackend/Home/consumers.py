import json
import base64
import numpy as np
import cv2
import time
import requests
from channels.generic.websocket import AsyncWebsocketConsumer
from ultralytics import YOLO
from asgiref.sync import sync_to_async
from django.utils import timezone
from .models import Room, Device, OccupancyEvent

# Load YOLOv8 model (downloads yolov8n.pt automatically on first run)
# We use nano model for fast real-time inference on CPU
model = YOLO('yolov8n.pt')

class OccupancyConsumer(AsyncWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.last_occupied_time = time.time()
        self.is_currently_occupied = False
        self.room_id = None
        self.empty_threshold_seconds = 10 * 60 # 10 minutes

    async def connect(self):
        await self.accept()
        # You could extract room ID from URL or query params in a real app
        # For hackathon, we'll just use a default room or create one
        self.room_id = await self.get_or_create_default_room()

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data=None, bytes_data=None):
        if text_data:
            data = json.loads(text_data)
            image_b64 = data.get('image', None)
            
            if image_b64:
                # Decode base64 image
                if ',' in image_b64:
                    image_b64 = image_b64.split(',')[1]
                
                img_bytes = base64.b64decode(image_b64)
                np_arr = np.frombuffer(img_bytes, np.uint8)
                img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

                # Run YOLOv8 inference
                # classes=[0] filters for 'person' only
                results = model(img, classes=[0], verbose=False)
                
                person_count = 0
                for r in results:
                    person_count += len(r.boxes)
                
                occupied = person_count > 0
                current_time = time.time()
                
                state_changed = False
                action_taken = None

                if occupied:
                    self.last_occupied_time = current_time
                    if not self.is_currently_occupied:
                        self.is_currently_occupied = True
                        state_changed = True
                        action_taken = "Devices Turned ON"
                        await self.control_devices(True)
                else:
                    # If empty for longer than threshold
                    if self.is_currently_occupied and (current_time - self.last_occupied_time) > self.empty_threshold_seconds:
                        self.is_currently_occupied = False
                        state_changed = True
                        action_taken = "Devices Turned OFF"
                        await self.control_devices(False)

                if state_changed:
                    await self.log_occupancy_event(occupied, person_count, action_taken)

                # Send response back to client (dashboard/phone)
                await self.send(text_data=json.dumps({
                    'status': 'success',
                    'occupied': occupied,
                    'people_count': person_count,
                    'action': action_taken,
                    'state_changed': state_changed
                }))
            else:
                await self.send(text_data=json.dumps({'error': 'No image provided'}))

    @sync_to_async
    def get_or_create_default_room(self):
        room, created = Room.objects.get_or_create(name="Hackathon Demo Room")
        if created:
            Device.objects.create(room=room, name="Main Fan", device_type="fan")
            Device.objects.create(room=room, name="Main Light", device_type="light")
        return room.id

    @sync_to_async
    def log_occupancy_event(self, occupied, count, action):
        room = Room.objects.get(id=self.room_id)
        OccupancyEvent.objects.create(
            room=room,
            is_occupied=occupied,
            people_count=count,
            action_taken=action
        )

    @sync_to_async
    def control_devices(self, turn_on):
        """
        Mock IoT HTTP Control.
        In a real scenario, this iterates through `Device` objects and sends HTTP POST to their `ip_address`.
        """
        room = Room.objects.get(id=self.room_id)
        devices = room.devices.all()
        for device in devices:
            device.is_on = turn_on
            device.save()
            
            # Simulate HTTP request to ESP
            if device.ip_address:
                try:
                    payload = {"state": "ON" if turn_on else "OFF"}
                    # requests.post(f"http://{device.ip_address}/control", json=payload, timeout=2)
                    print(f"Sent {payload} to {device.name} at {device.ip_address}")
                except Exception as e:
                    print(f"Failed to control device {device.name}: {e}")
            else:
                print(f"Device {device.name} state changed to {'ON' if turn_on else 'OFF'} (No IP configured)")
