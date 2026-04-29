# SEROS - Smart Energy & Resource Optimization System

Educational institutions often experience inefficient use of energy and resources due to a lack of monitoring and automation systems. **SEROS** is an AI-based system built to optimize energy consumption using real-time occupancy and usage analytics.

## 🚀 Features

- **Real-Time Occupancy Detection:** Uses a mobile camera or webcam to detect room usage in real-time.
- **Event-Driven IoT Automation:** Instead of polling, the system uses event-driven logic to adjust lighting and HVAC based on predefined rules (e.g., turn devices on when occupied, turn off if empty for 10+ minutes).
- **Energy Analytics Dashboard:** Tracks and analyzes consumption patterns over time, estimating cost savings.
- **Low Latency:** Uses WebSockets for real-time video frame streaming.

---

## 🛠️ Tech Stack

### **Backend (Django & Edge AI)**
- **Framework:** Django 5.2
- **WebSockets:** Django Channels & Daphne (ASGI Server) for low-latency, real-time video frame streaming.
- **AI Model:** `ultralytics` YOLOv8 Nano (`yolov8n.pt`). Runs directly inside the Django consumer for fast, real-time edge inference on the laptop CPU.
- **Database:** SQLite (for tracking OccupancyEvents and Device states locally).

### **Frontend (Mobile/Dashboard)**
- **Framework:** React Native (Expo)
- **Features:** Streams camera frames (Base64) to the backend via WebSockets. Serves as the dashboard UI for analytics.

### **IoT (Simulation/Integration)**
- **Protocol:** HTTP POST requests (or MQTT) triggered by Django event state-changes.
- **Hardware Target:** ESP8266 / ESP32 nodes connected to relays controlling Fans, ACs, and Lights.

---

## ⚙️ How It Works

1. **Camera Feed:** The React Native app opens the camera and sends frames as Base64 strings over a WebSocket connection to the Django backend.
2. **AI Processing:** Django Channels routes the frame to the `OccupancyConsumer`. The frame is decoded using OpenCV and fed into YOLOv8.
3. **State Management:** YOLO checks for the `person` class. If the room goes from "Empty" to "Occupied", an `OccupancyEvent` is logged, and an HTTP POST request is sent to turn the ESP devices ON.
4. **Energy Saving:** If no person is detected for a threshold (e.g., 10 minutes), the backend logs the change and sends a signal to turn the ESP devices OFF.

---

## 💻 How to Run the Project

### 1. Setup the Backend (Django + YOLOv8)

Open your terminal and navigate to the backend directory:
```bash
cd SEROSBackend
```

Create a virtual environment (optional but recommended):
```bash
python -m venv venv
venv\Scripts\activate  # Windows
```

Install the dependencies:
```bash
pip install -r requirements.txt
```

Run database migrations to create the Room and Device tables:
```bash
python manage.py makemigrations
python manage.py migrate
```

Start the ASGI Server (Daphne):
*Note: Because we are using Django Channels, we must run the ASGI application.*
```bash
python manage.py runserver
```
*(Django's runserver automatically wraps Daphne if it's in INSTALLED_APPS).*

> **Note on YOLOv8:** The first time you start the server and send a camera frame, the `yolov8n.pt` weights file (~6MB) will automatically download from Ultralytics.

### 2. Setup the Frontend (React Native Expo)

Open a new terminal window and navigate to the frontend directory:
```bash
cd SEROS
```

Install Node modules:
```bash
npm install
```

Start the Expo development server:
```bash
npx expo start
```
You can scan the QR code with the Expo Go app on your phone, or press `a` to run it on an Android Emulator.
