# S.E.R.O.S. backend

This is the live Django API used by the React/Expo client. It stores sections,
zones, devices, rules, detections, and device state in SQLite by default.

## Local setup

```powershell
cd newBackend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_seros
python manage.py runserver 0.0.0.0:8000
```

Set `SEROS_ESP32_URL` to the ESP32's LAN address, for example
`http://192.168.1.50`, before starting Django. The backend only requires LAN
reachability; the ESP32 does not need internet access.

When using the Windows Mobile Hotspot, upload the sketch and copy the IP shown
in the Arduino Serial Monitor (`[SEROS] Wi-Fi Connected! IP Address: ...`).
Use that same address for `SEROS_ESP32_URL`; the laptop and ESP32 must be on the
same hotspot network and Windows Firewall must allow the Django/private-network
connection. The ESP32 `/api/status` endpoint is a quick connectivity check.

YOLO detection requires the `ultralytics` package and a compatible model at
`SEROS_YOLO_MODEL` (defaults to `newBackend/yolov8n.pt`). The `/api/detect/`
endpoint accepts `{ "image": "data:image/jpeg;base64,..." }` and returns
normalized boxes, person count, and a processed JPEG with red center markers.

The browser captures a webcam frame every three seconds. Camera permission is
required. The mobile app consumes the same `/api/state/` endpoint and refreshes
every three seconds; it does not run YOLO on the phone.

## ESP32 network and hardware

Configure `WIFI_SSID` and `WIFI_PASS` in `applicatio/applicatio.ino`. The sketch
uses station mode and joins the existing Wi-Fi; it deliberately does not create
an ESP32 hotspot. It provides relay APIs at `/api/relay` and `/api/all`, status
at `/api/status`, and AC learning/control endpoints under `/api/ac/`.

Install the Arduino libraries `IRremoteESP8266` and `Adafruit HTU21DF`.
The IR receiver is on GPIO 14 and the IR LED driver is on GPIO 4. Relay pins
are GPIO 16, 17, 18, and 19. Relay polarity and wiring must be checked for the
actual board. AC and relay behavior has not been hardware-tested here.
