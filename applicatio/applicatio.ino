/*
 * S.E.R.O.S. ESP32 LAN Controller (4-Quadrant Relay & Sensor Node)
 * 
 * Hardware Mapping:
 * - Quadrant 1 -> Relay 1 -> GPIO 16
 * - Quadrant 2 -> Relay 2 -> GPIO 17
 * - Quadrant 3 -> Relay 3 -> GPIO 18
 * - Quadrant 4 -> Relay 4 -> GPIO 19
 * - HTU21DF Temp/Humidity Sensor -> I2C (SDA=GPIO 21, SCL=GPIO 22)
 * - IR Receiver -> GPIO 14
 * - IR Transmitter / AC Control -> GPIO 4
 */
#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <Adafruit_HTU21DF.h>
#include <IRremoteESP8266.h>
#include <IRrecv.h>
#include <IRsend.h>
#include <IRutils.h>
#include <IRac.h>

// Wi-Fi Credentials
const char* WIFI_SSID = "seros";
const char* WIFI_PASS = "***";
const char* DEVICE_NAME = "SEROS-ESP32";

// Relay Hardware Mapping (Relay 1-4 for Quadrants 1-4)
const uint16_t relayPins[4] = {16, 17, 18, 19};
const bool ACTIVE_LOW = true; // Most 4-channel relay boards activate when pin is LOW

// IR Hardware Pins
const uint16_t kRecvPin = 14;
const uint16_t kIrLedPin = 4;
const uint16_t kCaptureBufferSize = 1024;
const uint8_t kTimeout = 50;
const uint16_t kMinUnknownSize = 12;
const uint8_t kRawSlots = 4;
const uint16_t kRawMax = 800;

WebServer server(80);
Adafruit_HTU21DF sensor;
IRrecv irrecv(kRecvPin, kCaptureBufferSize, kTimeout, true);
IRsend irsend(kIrLedPin);
IRac ac(kIrLedPin);
decode_results results;

bool relays[4] = {false, false, false, false};
bool sensorAvailable = false;
bool protocolReady = false;
int8_t learnTarget = -1;
unsigned long learnStarted = 0;
String statusMessage = "Ready";
uint16_t rawSlots[kRawSlots][kRawMax];
uint16_t rawLengths[kRawSlots] = {0, 0, 0, 0};

// CORS Headers for Direct Web / Mobile Client Requests
void cors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void setRelay(uint8_t index, bool on) {
  if (index >= 4) return;
  relays[index] = on;
  digitalWrite(relayPins[index], on == ACTIVE_LOW ? LOW : HIGH);
  Serial.printf("[SEROS] Quadrant %d / Relay %d (Pin %d) -> %s\n",
                index + 1, index + 1, relayPins[index], on ? "ON" : "OFF");
}

String statusJson() {
  String out = "{\"status\":\"ok\",\"device\":\"" + String(DEVICE_NAME) + "\",";
  out += "\"ip\":\"" + WiFi.localIP().toString() + "\",\"wifi_rssi\":" + String(WiFi.RSSI()) + ",";
  out += "\"relays\":[";
  for (uint8_t i = 0; i < 4; ++i) {
    out += String(i ? "," : "") + String(relays[i] ? "true" : "false");
  }
  out += "],\"sensor\":" + String(sensorAvailable ? "true" : "false") + ",\"temperature\":";
  
  if (sensorAvailable) {
    float temp = sensor.readTemperature();
    if (isnan(temp)) out += "null";
    else out += String(temp, 1);
  } else {
    out += "null";
  }
  
  out += ",\"humidity\":";
  if (sensorAvailable) {
    float hum = sensor.readHumidity();
    if (isnan(hum)) out += "null";
    else out += String(hum, 1);
  } else {
    out += "null";
  }
  
  out += ",\"ac_protocol\":\"" + String(protocolReady ? typeToString(ac.next.protocol) : "UNKNOWN") + "\",";
  out += "\"ac_power\":" + String(ac.next.power ? "true" : "false") + ",\"ac_temperature\":" + String(ac.next.degrees, 0);
  out += ",\"message\":\"" + statusMessage + "\"}";
  return out;
}

void sendState() {
  if (!protocolReady) {
    statusMessage = "Learn or select an AC protocol first";
    return;
  }
  if (learnTarget >= 0) {
    learnTarget = -1;
    irrecv.disableIRIn();
  }
  statusMessage = ac.sendAc() ? "AC state sent" : "AC send failed";
}

void checkLearning() {
  if (learnTarget < 0) return;
  if (millis() - learnStarted > 30000) {
    learnTarget = -1;
    irrecv.disableIRIn();
    statusMessage = "Learning timed out";
    return;
  }
  if (!irrecv.decode(&results)) return;
  if (results.rawlen < 20) {
    irrecv.resume();
    return;
  }
  if (learnTarget == 0 && results.decode_type != decode_type_t::UNKNOWN &&
      IRac::isProtocolSupported(results.decode_type)) {
    stdAc::state_t learned;
    if (IRAcUtils::decodeToState(&results, &learned)) {
      ac.next = learned;
      ac.next.celsius = true;
      protocolReady = true;
      statusMessage = "Learned " + typeToString(results.decode_type);
      learnTarget = -1;
      irrecv.disableIRIn();
      return;
    }
  } else if (learnTarget > 0) {
    uint8_t slot = learnTarget - 1;
    uint16_t length = getCorrectedRawLength(&results);
    uint16_t* raw = resultToRawArray(&results);
    if (raw && length <= kRawMax) {
      memcpy(rawSlots[slot], raw, length * sizeof(uint16_t));
      rawLengths[slot] = length;
      statusMessage = "Saved raw slot " + String(slot + 1);
      delete[] raw;
      learnTarget = -1;
      irrecv.disableIRIn();
      return;
    }
    if (raw) delete[] raw;
  }
  irrecv.resume();
}

void setupAcDefaults() {
  ac.next.protocol = decode_type_t::UNKNOWN;
  ac.next.model = -1;
  ac.next.power = false;
  ac.next.mode = stdAc::opmode_t::kCool;
  ac.next.celsius = true;
  ac.next.degrees = 24;
  ac.next.fanspeed = stdAc::fanspeed_t::kAuto;
}

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n[SEROS] Booting ESP32 Controller...");

  // Prevent relay chattering on boot: write inactive state before setting OUTPUT mode
  for (uint8_t i = 0; i < 4; ++i) {
    digitalWrite(relayPins[i], ACTIVE_LOW ? HIGH : LOW);
    pinMode(relayPins[i], OUTPUT);
    relays[i] = false;
    Serial.printf("[SEROS] Armed Relay %d -> GPIO %d\n", i + 1, relayPins[i]);
  }

  // Initialize I2C for HTU21DF Temp/Humidity Sensor
  Wire.begin(21, 22);
  sensorAvailable = sensor.begin();
  if (sensorAvailable) {
    Serial.println("[SEROS] HTU21DF sensor detected on I2C (GPIO 21/22)");
  } else {
    Serial.println("[SEROS] HTU21DF sensor not detected (running in sensorless mode)");
  }

  setupAcDefaults();
  irsend.begin();
  irrecv.setUnknownThreshold(kMinUnknownSize);

  // Connect to Local Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("[SEROS] Connecting to Wi-Fi '%s'...", WIFI_SSID);
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 30000) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[SEROS] Wi-Fi Connected! IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("[SEROS] Wi-Fi connection timed out. Will retry in background loop.");
  }

  // Web Server Routes
  server.onNotFound([]() {
    cors();
    if (server.method() == HTTP_OPTIONS) {
      server.send(204);
    } else {
      server.send(404, "application/json", "{\"error\":\"Endpoint not found\"}");
    }
  });

  // GET /api/status - Complete hardware state
  server.on("/api/status", HTTP_ANY, []() {
    cors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    server.send(200, "application/json", statusJson());
  });

  // /api/relay - Control individual quadrant relay (1-4)
  // Supports GET query args: ?id=1&state=1
  // Supports POST query/body: id=1, state=1
  server.on("/api/relay", HTTP_ANY, []() {
    cors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }

    int id = -1;
    int state = -1;

    // Check query args or form args
    if (server.hasArg("id")) id = server.arg("id").toInt() - 1;
    else if (server.hasArg("relay")) id = server.arg("relay").toInt() - 1;

    if (server.hasArg("state")) state = server.arg("state").toInt();
    else if (server.hasArg("on")) state = (server.arg("on") == "true" || server.arg("on") == "1") ? 1 : 0;

    // Also support JSON body if posted
    if ((id < 0 || state < 0) && server.hasArg("plain")) {
      String body = server.arg("plain");
      int idIdx = body.indexOf("\"id\":");
      if (idIdx == -1) idIdx = body.indexOf("\"relay\":");
      if (idIdx != -1) {
        id = body.substring(idIdx + 5).toInt() - 1;
      }
      int stateIdx = body.indexOf("\"state\":");
      if (stateIdx != -1) {
        state = body.substring(stateIdx + 8).toInt();
      } else if (body.indexOf("\"on\":true") != -1 || body.indexOf("\"on\": true") != -1) {
        state = 1;
      } else if (body.indexOf("\"on\":false") != -1 || body.indexOf("\"on\": false") != -1) {
        state = 0;
      }
    }

    if (id < 0 || id > 3 || (state != 0 && state != 1)) {
      server.send(400, "application/json", "{\"error\":\"id must be 1-4 and state must be 0 or 1\"}");
      return;
    }

    setRelay(id, state == 1);
    server.send(200, "application/json", "{\"status\":\"ok\",\"relay\":" + String(id + 1) + ",\"state\":" + String(state) + "}");
  });

  // /api/all - Switch all relays ON or OFF
  server.on("/api/all", HTTP_ANY, []() {
    cors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    int state = server.arg("state").toInt();
    for (uint8_t i = 0; i < 4; ++i) setRelay(i, state == 1);
    server.send(200, "application/json", "{\"status\":\"ok\",\"all_state\":" + String(state) + "}");
  });

  // AC Remote Learning and IR Control Routes
  server.on("/api/ac/learn", HTTP_ANY, []() {
    cors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    learnTarget = 0;
    learnStarted = millis();
    irrecv.enableIRIn();
    statusMessage = "Listening for AC remote";
    server.send(200, "application/json", "{\"status\":\"learning\"}");
  });

  server.on("/api/ac/raw-learn", HTTP_ANY, []() {
    cors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    int slot = server.arg("slot").toInt();
    if (slot < 1 || slot > 4) {
      server.send(400, "application/json", "{\"error\":\"slot must be 1-4\"}");
      return;
    }
    learnTarget = slot;
    learnStarted = millis();
    irrecv.enableIRIn();
    server.send(200, "application/json", "{\"status\":\"learning\",\"slot\":" + String(slot) + "}");
  });

  server.on("/api/ac/power", HTTP_ANY, []() {
    cors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    if (!protocolReady) {
      server.send(409, "application/json", "{\"error\":\"AC protocol not learned\"}");
      return;
    }
    ac.next.power = server.arg("on") == "1" || server.arg("on") == "true";
    sendState();
    server.send(200, "application/json", statusJson());
  });

  server.on("/api/ac/temp", HTTP_ANY, []() {
    cors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    if (!protocolReady) {
      server.send(409, "application/json", "{\"error\":\"AC protocol not learned\"}");
      return;
    }
    int temperature = constrain(server.arg("value").toInt(), 16, 30);
    ac.next.degrees = temperature;
    ac.next.power = true;
    sendState();
    server.send(200, "application/json", statusJson());
  });

  server.on("/api/ac/mode", HTTP_ANY, []() {
    cors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    if (!protocolReady) {
      server.send(409, "application/json", "{\"error\":\"AC protocol not learned\"}");
      return;
    }
    String mode = server.arg("mode");
    if (mode == "cool") ac.next.mode = stdAc::opmode_t::kCool;
    else if (mode == "heat") ac.next.mode = stdAc::opmode_t::kHeat;
    else if (mode == "dry") ac.next.mode = stdAc::opmode_t::kDry;
    else if (mode == "fan") ac.next.mode = stdAc::opmode_t::kFan;
    else if (mode == "auto") ac.next.mode = stdAc::opmode_t::kAuto;
    else {
      server.send(400, "application/json", "{\"error\":\"unsupported mode\"}");
      return;
    }
    ac.next.power = true;
    sendState();
    server.send(200, "application/json", statusJson());
  });

  server.on("/api/ac/fan", HTTP_ANY, []() {
    cors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    if (!protocolReady) {
      server.send(409, "application/json", "{\"error\":\"AC protocol not learned\"}");
      return;
    }
    String fan = server.arg("fan");
    if (fan == "auto") ac.next.fanspeed = stdAc::fanspeed_t::kAuto;
    else if (fan == "low") ac.next.fanspeed = stdAc::fanspeed_t::kLow;
    else if (fan == "medium") ac.next.fanspeed = stdAc::fanspeed_t::kMedium;
    else if (fan == "high") ac.next.fanspeed = stdAc::fanspeed_t::kHigh;
    else {
      server.send(400, "application/json", "{\"error\":\"unsupported fan speed\"}");
      return;
    }
    sendState();
    server.send(200, "application/json", statusJson());
  });

  server.begin();
  Serial.println("[SEROS] HTTP API Server listening on port 80");
}

void loop() {
  // Non-blocking WiFi auto-reconnect (rate-limited to once every 10 seconds to avoid watchdog crash)
  static unsigned long lastWifiCheck = 0;
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastWifiCheck > 10000) {
      lastWifiCheck = millis();
      Serial.println("[SEROS] Wi-Fi lost. Attempting reconnection...");
      WiFi.reconnect();
    }
  }

  server.handleClient();
  checkLearning();
}
