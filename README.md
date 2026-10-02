# SEROS - Smart Energy & Resource Optimization System

Educational institutions and commercial buildings often experience inefficient use of energy due to a lack of monitoring and automation systems. **SEROS** is an AI-powered system built to optimize energy consumption using real-time edge computer vision, live environmental sensors, and advanced machine learning analytics.

## 🚀 Key Features

- **Real-Time Edge Occupancy Detection:** Uses a mobile camera to stream frames to a local Django server running **YOLOv8s** (Small) for highly accurate human detection.
- **Dynamic Fan/Lighting Routing:** Instantly detects spatial coordinates of occupants. If people are strictly on the left or right, it communicates directly with Arduino via Serial (`COM5`) to toggle specific relays, ensuring energy isn't wasted cooling empty zones.
- **Machine Learning Energy Forecasting:** Leverages a `RandomForestRegressor` trained on Kaggle IoT Electricity Consumption datasets to predict the building's energy footprint for the next 7 days based on dynamic variables like temperature, time, and occupancy.
- **Gemini 3 AI Analytics:** Integrates Google's `gemini-3-flash-preview` model for automated energy usage summarization and witty feedback.
- **Live Weather Integration:** Ingests live temperature and humidity using the Weather API (`weatherapi.com`) to feed accurate real-time environmental data to the ML regression models.
- **Sage-Slate-Charcoal Glassmorphism UI:** A sleek, futuristic React Native dashboard built entirely using dynamic RGBA values for deep, professional frosted glass visuals.

---

## 🛠️ Tech Stack

### **Backend (Django & AI Analytics)**
- **Framework:** Django 5.2 (REST Framework)
- **Computer Vision:** `ultralytics` YOLOv8 Small (`yolov8s.pt`)
- **Machine Learning:** `scikit-learn` (Random Forest), `pandas`, `numpy`
- **GenAI Integration:** Google Gemini API
- **Hardware Comms:** `pyserial` (Serial communication with Arduino on COM5)
- **Database:** SQLite (local hackathon demo persistent storage) & `django.core.cache` (Weather API caching)

### **Frontend (Mobile Dashboard)**
- **Framework:** React Native (Expo)
- **UI Architecture:** Custom Glassmorphism implementation (`theme.js`)
- **Charting:** `react-native-chart-kit` and `react-native-svg` for visual data representation.

### **IoT Hardware**
- **Microcontroller:** Arduino Uno / Mega
- **Peripherals:** Relay Modules (Fans, Lights)
- **Communication:** USB Serial (COM5 at 9600 baud)

---

## ⚙️ Core Workflows

1. **Computer Vision Loop:** The Expo Camera loops at custom capture intervals, pinging Base64 encoded JPEGs to `/api/detect/`.
2. **Zone Logic & Hardware:** YOLO detects centroids (x,y) of all occupants. If `x < 0.5`, it routes `left\n` to the Arduino over Serial. If `x > 0.5`, it routes `right\n`. If zero occupants, it routes `off\n`.
3. **ML Prediction Engine:** The React Native dashboard queries `/api/ml-predict/`. The Django backend grabs live temperature from the weather API, mixes it with timestamp vectors, and runs inference on the pre-trained `ml_model.pkl`.
4. **Billing Forecast:** The projected kWh is mathematically pushed through local electricity tariff slab structures (e.g., Rs. 3.75 for <100 units, scaling upwards) to give a real monetary estimate.

---

## 💻 How to Run the Project Locally

### 1. Configure the `.env` File
Create a `.env` file in the `SEROSBackend` directory containing:
```ini
GEMINI_API_KEY="AIzaSy..." # Your Google Gemini API Key
weatherAPI="b9add9c..."    # Your WeatherAPI.com Key
```

### 2. Setup the Backend (Django + ML)
Open your terminal and navigate to the backend directory:
```bash
cd SEROSBackend
```

Create a virtual environment:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
```

Install the dependencies:
```bash
pip install -r requirements.txt
pip install pandas scikit-learn ultralytics pyserial google-genai django-cors-headers
```

**(Crucial Step) Train the ML Model:**
```bash
python manage.py shell -c "exec(open('Home/train_model.py').read())"
```
*This will ingest `train.csv`, build the `RandomForestRegressor`, and output `ml_model.pkl` to your root directory.*

Run database migrations:
```bash
python manage.py makemigrations
python manage.py migrate
```

Start the Django API:
```bash
python manage.py runserver 0.0.0.0:8000
```
> **Note on YOLOv8:** The first time you start the server, `yolov8s.pt` weights (~22MB) will automatically download.

### 3. Setup the Frontend (React Native)
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
*Scan the QR code with the Expo Go app or press `a` to run it on an Android Emulator.*

### 4. Hardware Setup (Optional for Demo)
Upload `appliances.ino` to your Arduino using the Arduino IDE. Make sure it is connected to `COM5` (or update `views.py` to match your specific COM port).
