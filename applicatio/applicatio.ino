/*
 * S.E.R.O.S. ESP32 LAN Controller & Universal AC Remote
 * 
 * Integrated Firmware Combining:
 * 1. 4-Quadrant Relay Controller (GPIO 16, 17, 18, 19)
 * 2. Environmental Sensor Telemetry (Adafruit HTU21DF on I2C SDA=21, SCL=22)
 * 3. Universal IR AC Remote (Auto-detect & 28 Vendor Protocols via IRremoteESP8266)
 * 4. Raw IR Record & Replay (4 Fallback Slots for Unsupported Remotes)
 * 5. Direct Web Browser Dashboard (http://192.168.137.97)
 * 6. Full REST API with CORS for Django Backend, React Web UI & React Native Mobile App
 *
 * Hardware Wiring:
 * - Quadrant 1 -> Relay 1 -> GPIO 16 (Active LOW)
 * - Quadrant 2 -> Relay 2 -> GPIO 17 (Active LOW)
 * - Quadrant 3 -> Relay 3 -> GPIO 18 (Active LOW)
 * - Quadrant 4 -> Relay 4 -> GPIO 19 (Active LOW)
 * - HTU21DF Temp/Humidity Sensor -> I2C (SDA=GPIO 21, SCL=GPIO 22)
 * - IR Receiver (VS1838B / KY-022) -> GPIO 14 (+ to 3.3V, - to GND)
 * - IR Transmitter LED -> GPIO 4 (via NPN transistor 2N2222 / BC547)
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

// ================= USER CONFIGURATION =================
const char* WIFI_SSID   = "RehanLP"; // Matches Windows Laptop Mobile Hotspot
const char* WIFI_PASS   = "12345678";
const char* DEVICE_NAME = "SEROS-ESP32";

// Relay Hardware Mapping (Relay 1-4 for Quadrants 1-4)
const uint16_t relayPins[4] = {16, 17, 18, 19};
const bool ACTIVE_LOW       = false;

// IR Hardware Pins
const uint16_t kRecvPin  = 14; // IR receiver signal pin
const uint16_t kIrLedPin = 4;  // IR transmitter LED pin

// Receiver Settings for Long AC Frames
const uint16_t kCaptureBufferSize = 1024;
const uint8_t  kTimeout           = 50; // ms of silence = end of packet
const uint16_t kMinUnknownSize    = 12;

// Raw Replay Slots (Fallback for unsupported remotes)
const uint8_t  kRawSlots = 4;
const uint16_t kRawMax   = 800;
uint16_t rawSlots[kRawSlots][kRawMax];
uint16_t rawLengths[kRawSlots] = {0, 0, 0, 0};

// Supported AC Vendor Protocols for Manual Selection
const char* kVendors[] = {
  "COOLIX", "DAIKIN", "DAIKIN2", "MITSUBISHI_AC", "MITSUBISHI_HEAVY_152",
  "MITSUBISHI_HEAVY_88", "VOLTAS", "LG", "LG2", "SAMSUNG_AC", "HITACHI_AC",
  "CARRIER_AC", "GREE", "PANASONIC_AC", "HAIER_AC", "MIDEA", "FUJITSU_AC",
  "ELECTRA_AC", "WHIRLPOOL_AC", "TCL112AC", "KELVINATOR", "TOSHIBA_AC",
  "SHARP_AC", "TECO", "SANYO_AC", "AMCOR", "ARGO", "CORONA_AC"
};
const size_t kVendorCount = sizeof(kVendors) / sizeof(kVendors[0]);

// ================= HARDWARE INSTANCES =================
WebServer server(80);
Adafruit_HTU21DF sensor;
IRrecv irrecv(kRecvPin, kCaptureBufferSize, kTimeout, true);
IRsend irsend(kIrLedPin);
IRac ac(kIrLedPin);
decode_results results;

// ================= SYSTEM STATE =================
bool relays[4] = {false, false, false, false};
bool sensorAvailable = false;
bool protocolReady = false;

const int8_t LEARN_NONE = -1;
const int8_t LEARN_AUTO = 0; // 1..kRawSlots = raw slot (slot index + 1)
int8_t learnTarget = LEARN_NONE;
unsigned long learnStarted = 0;
const unsigned long kLearnTimeoutMs = 30000;

String statusMessage = "Ready. Point remote to learn or pick a vendor.";

// ================= CORS & HELPERS =================
void cors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS,PUT,DELETE");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

String modeToString(stdAc::opmode_t m) {
  switch (m) {
    case stdAc::opmode_t::kAuto: return "auto";
    case stdAc::opmode_t::kCool: return "cool";
    case stdAc::opmode_t::kHeat: return "heat";
    case stdAc::opmode_t::kDry:  return "dry";
    case stdAc::opmode_t::kFan:  return "fan";
    default: return "off";
  }
}

String fanToString(stdAc::fanspeed_t f) {
  switch (f) {
    case stdAc::fanspeed_t::kMin:    return "low";
    case stdAc::fanspeed_t::kLow:    return "low";
    case stdAc::fanspeed_t::kMedium: return "medium";
    case stdAc::fanspeed_t::kHigh:   return "high";
    case stdAc::fanspeed_t::kMax:    return "high";
    default: return "auto";
  }
}

void setRelay(uint8_t index, bool on) {
  if (index >= 4) return;
  relays[index] = on;
  digitalWrite(relayPins[index], on == ACTIVE_LOW ? LOW : HIGH);
  Serial.printf("[SEROS] %s Quadrant %d / Relay %d (Pin %d) -> %s\n",
                on ? "[ON]" : "[OFF]", index + 1, index + 1, relayPins[index], on ? "ON" : "OFF");
}

void setupAcDefaults() {
  ac.next.protocol = decode_type_t::MITSUBISHI_AC; // Default ready protocol
  ac.next.model    = -1;
  ac.next.mode     = stdAc::opmode_t::kCool;
  ac.next.power    = false;
  ac.next.celsius  = true;
  ac.next.degrees  = 24;
  ac.next.fanspeed = stdAc::fanspeed_t::kAuto;
  ac.next.swingv   = stdAc::swingv_t::kOff;
  ac.next.swingh   = stdAc::swingh_t::kOff;
  ac.next.quiet    = false;
  ac.next.turbo    = false;
  ac.next.econo    = false;
  ac.next.light    = false;
  ac.next.filter   = false;
  ac.next.clean    = false;
  ac.next.beep     = false;
  ac.next.sleep    = -1;
  ac.next.clock    = -1;
  protocolReady    = true;
}

void startLearn(int8_t target) {
  learnTarget = target;
  learnStarted = millis();
  irrecv.enableIRIn();
  if (target == LEARN_AUTO) {
    statusMessage = "Listening for remote... point remote at receiver and press a button.";
  } else {
    statusMessage = "Listening for Raw Slot " + String(target) + "... press any remote button.";
  }
  Serial.println("[IR] " + statusMessage);
}

void stopLearn() {
  learnTarget = LEARN_NONE;
  irrecv.enableIRIn(); // Keep receiver active for physical remote manual override
}

void sendState() {
  if (!protocolReady) {
    statusMessage = "No AC protocol selected or learned yet.";
    return;
  }
  if (learnTarget != LEARN_NONE) stopLearn();

  // Temporarily disable receiver so it does not pick up its own transmitted IR LED bursts
  irrecv.disableIRIn();
  bool ok = ac.sendAc();
  delay(120);
  irrecv.enableIRIn();

  statusMessage = String(ok ? "AC Command Sent: " : "AC Send FAILED: ") +
                  typeToString(ac.next.protocol) +
                  ", Power: " + (ac.next.power ? "ON" : "OFF") +
                  ", Temp: " + String(ac.next.degrees, 0) + "C" +
                  ", Mode: " + modeToString(ac.next.mode);
  Serial.println("[IR] " + statusMessage);
}

void handleMiniRemoteOverride(decode_results *res) {
  uint32_t val = (uint32_t)(res->value & 0xFFFFFFFF);
  uint8_t cmd = res->command;

  Serial.printf("\n[IR REMOTE] Protocol: %s, Command: 0x%02X, Value: 0x%08X\n",
                typeToString(res->decode_type).c_str(), cmd, val);

  // Button UP (▲): AC Target Temperature + 1°C
  if (val == 0xFF18E7 || (cmd == 0x18 && val != 0xFF629D) || (cmd == 0x40 && val == 0xFF02FD) || cmd == 0x09) {
    if (ac.next.degrees < 30) ac.next.degrees++;
    ac.next.power = true;
    sendState();
    statusMessage = "Manual Override: AC Temp -> " + String((int)ac.next.degrees) + "C";
    Serial.println("[OVERRIDE] " + statusMessage);
    return;
  }

  // Button DOWN (▼): AC Target Temperature - 1°C
  if (val == 0xFF52AD || val == 0xFF4AB5 || (cmd == 0x52 && val != 0xFF9867) || cmd == 0x4A) {
    if (ac.next.degrees > 16) ac.next.degrees--;
    ac.next.power = true;
    sendState();
    statusMessage = "Manual Override: AC Temp -> " + String((int)ac.next.degrees) + "C";
    Serial.println("[OVERRIDE] " + statusMessage);
    return;
  }

  // Button LEFT (◄): Cycle AC Operating Mode (Cool -> Heat -> Dry -> Fan -> Auto)
  if (val == 0xFF10EF || (cmd == 0x08 && val != 0xFF22DD)) {
    if (ac.next.mode == stdAc::opmode_t::kCool) ac.next.mode = stdAc::opmode_t::kHeat;
    else if (ac.next.mode == stdAc::opmode_t::kHeat) ac.next.mode = stdAc::opmode_t::kDry;
    else if (ac.next.mode == stdAc::opmode_t::kDry) ac.next.mode = stdAc::opmode_t::kFan;
    else if (ac.next.mode == stdAc::opmode_t::kFan) ac.next.mode = stdAc::opmode_t::kAuto;
    else ac.next.mode = stdAc::opmode_t::kCool;
    ac.next.power = true;
    sendState();
    statusMessage = "Manual Override: AC Mode -> " + modeToString(ac.next.mode);
    Serial.println("[OVERRIDE] " + statusMessage);
    return;
  }

  // Button RIGHT (►): Cycle AC Fan (Auto -> Low -> Med -> High)
  if (val == 0xFF5AA5 || (cmd == 0x5A && val != 0xFFB04F)) {
    if (ac.next.fanspeed == stdAc::fanspeed_t::kAuto) ac.next.fanspeed = stdAc::fanspeed_t::kLow;
    else if (ac.next.fanspeed == stdAc::fanspeed_t::kLow) ac.next.fanspeed = stdAc::fanspeed_t::kMedium;
    else if (ac.next.fanspeed == stdAc::fanspeed_t::kMedium) ac.next.fanspeed = stdAc::fanspeed_t::kHigh;
    else ac.next.fanspeed = stdAc::fanspeed_t::kAuto;
    sendState();
    statusMessage = "Manual Override: AC Fan -> " + fanToString(ac.next.fanspeed);
    Serial.println("[OVERRIDE] " + statusMessage);
    return;
  }

  // Button OK: Toggle AC Power via IR Transmitter (GPIO 4)
  if (val == 0xFF38C7 || cmd == 0x1C || cmd == 0x38) {
    ac.next.power = !ac.next.power;
    sendState();
    statusMessage = String("Manual Override: AC Power ") + (ac.next.power ? "ON" : "OFF");
    Serial.println("[OVERRIDE] " + statusMessage);
    return;
  }

  // Button 1: Toggle Relay 1 / Quadrant 1 (Light)
  if (val == 0xFFA25D || val == 0xFF30CF || cmd == 0x45 || cmd == 0x0C || cmd == 0xA2) {
    setRelay(0, !relays[0]);
    statusMessage = String("Manual Override: Quadrant 1 Light ") + (relays[0] ? "ON" : "OFF");
    Serial.println("[OVERRIDE] " + statusMessage);
    return;
  }

  // Button 2: Toggle Relay 2 / Quadrant 2 (Light)
  if (val == 0xFF629D || cmd == 0x46 || cmd == 0x62) {
    setRelay(1, !relays[1]);
    statusMessage = String("Manual Override: Quadrant 2 Light ") + (relays[1] ? "ON" : "OFF");
    Serial.println("[OVERRIDE] " + statusMessage);
    return;
  }

  // Button 3: Toggle Relay 3 / Quadrant 3 (Fan / Light)
  if (val == 0xFFE21D || val == 0xFF7A85 || cmd == 0x47 || cmd == 0x5E || cmd == 0xE2) {
    setRelay(2, !relays[2]);
    statusMessage = String("Manual Override: Quadrant 3 ") + (relays[2] ? "ON" : "OFF");
    Serial.println("[OVERRIDE] " + statusMessage);
    return;
  }

  // Button 4: Toggle Relay 4 / Quadrant 4 (Fan / Light)
  if (val == 0xFF22DD || cmd == 0x44 || cmd == 0x22) {
    setRelay(3, !relays[3]);
    statusMessage = String("Manual Override: Quadrant 4 ") + (relays[3] ? "ON" : "OFF");
    Serial.println("[OVERRIDE] " + statusMessage);
    return;
  }

  // Button 0 or Button * : Master Power Toggle (All Relays ON/OFF)
  if (val == 0xFF9867 || val == 0xFF6897 || val == 0xFF42BD || val == 0xFF00FF ||
      cmd == 0x19 || cmd == 0x16 || cmd == 0x68 || cmd == 0x98 || cmd == 0x42 || cmd == 0x48) {
    bool anyOn = relays[0] || relays[1] || relays[2] || relays[3];
    bool target = !anyOn;
    for (uint8_t i = 0; i < 4; ++i) setRelay(i, target);
    statusMessage = String("Manual Override: All Relays ") + (target ? "ON" : "OFF");
    Serial.println("[OVERRIDE] " + statusMessage);
    return;
  }

  // Button # : Resend Current AC State
  if (val == 0xFFB04F || cmd == 0x0D || cmd == 0xB0) {
    sendState();
    statusMessage = "Manual Override: AC Resend Triggered";
    Serial.println("[OVERRIDE] " + statusMessage);
    return;
  }
}

void checkIRReceiver() {
  if (learnTarget == LEARN_NONE) {
    // Continuous manual override listening
    if (!irrecv.decode(&results)) return;
    static unsigned long lastIrTime = 0;
    if (results.repeat && millis() - lastIrTime < 300) {
      irrecv.resume();
      return;
    }
    handleMiniRemoteOverride(&results);
    lastIrTime = millis();
    irrecv.resume();
    return;
  }

  if (millis() - learnStarted > kLearnTimeoutMs) {
    stopLearn();
    statusMessage = "Learning timed out (30s). Press learn again.";
    Serial.println("[IR] Learning timed out");
    return;
  }

  if (!irrecv.decode(&results)) return;

  // Filter out short noise bursts
  if (results.rawlen < 20) {
    irrecv.resume();
    return;
  }

  Serial.println("\n=========== IR SIGNAL DETECTED ===========");
  Serial.print(resultToHumanReadableBasic(&results));
  Serial.println(IRAcUtils::resultAcToString(&results));
  Serial.printf("Pulses: %d\n", results.rawlen - 1);

  if (learnTarget == LEARN_AUTO) {
    stdAc::state_t learnedState;
    if (results.decode_type != decode_type_t::UNKNOWN &&
        IRac::isProtocolSupported(results.decode_type) &&
        IRAcUtils::decodeToState(&results, &learnedState)) {
      learnedState.power   = true;
      learnedState.celsius = true;
      if (learnedState.mode == stdAc::opmode_t::kOff) learnedState.mode = stdAc::opmode_t::kCool;
      if (learnedState.degrees < 16 || learnedState.degrees > 30) learnedState.degrees = 24;

      ac.next = learnedState;
      protocolReady = true;
      statusMessage = "Learned protocol: " + typeToString(results.decode_type) + ". AC ready!";
      Serial.println("[IR] SUCCESS: Stored protocol " + typeToString(results.decode_type));
      stopLearn();
    } else {
      statusMessage = "Captured " + typeToString(results.decode_type) +
                      " (not auto-recognized AC). Try again, pick vendor, or use raw slot.";
      Serial.println("[IR] Unknown or unsupported AC protocol");
      irrecv.resume();
    }
  } else {
    // Raw Slot Learn (1..4)
    uint8_t slot = learnTarget - 1;
    uint16_t len = getCorrectedRawLength(&results);
    uint16_t *arr = resultToRawArray(&results);
    if (arr != NULL && len <= kRawMax) {
      memcpy(rawSlots[slot], arr, len * sizeof(uint16_t));
      rawLengths[slot] = len;
      statusMessage = "Raw Slot " + String(slot + 1) + " saved (" + String(len) + " pulses).";
      Serial.printf("[IR] Raw slot %d stored (%d pulses)\n", slot + 1, len);
      stopLearn();
    } else {
      statusMessage = "Raw signal too long or memory error. Try again.";
      irrecv.resume();
    }
    if (arr != NULL) delete[] arr;
  }
  Serial.println("==========================================\n");
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
  out += "\"ac_power\":" + String(ac.next.power ? "true" : "false") + ",";
  out += "\"ac_temperature\":" + String(ac.next.degrees, 0) + ",";
  out += "\"ac_mode\":\"" + modeToString(ac.next.mode) + "\",";
  out += "\"ac_fan\":\"" + fanToString(ac.next.fanspeed) + "\",";
  out += "\"learning\":" + String(learnTarget != LEARN_NONE ? "true" : "false") + ",";
  out += "\"message\":\"" + statusMessage + "\"}";
  return out;
}

// ================= BROWSER WEB DASHBOARD =================
const char PAGE_STYLE[] = R"=====(
<style>
* { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  text-align: center;
  background: #0b1120;
  color: #f8fafc;
  margin: 0;
  padding: 16px;
}
.header { margin-bottom: 20px; }
.header h1 { margin: 6px 0 2px; font-size: 24px; color: #38bdf8; letter-spacing: 0.5px; }
.header p { margin: 0; font-size: 13px; color: #94a3b8; }
.container { max-width: 500px; margin: 0 auto; }
.card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.card h2 { margin: 0 0 12px; font-size: 16px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 1px; }
.btn {
  display: inline-block;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  margin: 4px;
  color: #fff;
  border-radius: 8px;
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
}
.btn:active { transform: scale(0.97); }
.btn-amber { background: #d97706; }
.btn-green { background: #16a34a; }
.btn-red   { background: #dc2626; }
.btn-blue  { background: #2563eb; }
.btn-slate { background: #475569; }
.btn-cyan  { background: #0284c7; }
.relay-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
.relay-box {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 12px;
}
.relay-title { font-size: 13px; font-weight: 600; color: #94a3b8; margin-bottom: 6px; }
.badge { display: inline-block; padding: 3px 8px; font-size: 11px; font-weight: 700; border-radius: 20px; text-transform: uppercase; }
.badge-on { background: rgba(34,197,94,0.2); color: #4ade80; border: 1px solid #22c55e; }
.badge-off { background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid #ef4444; }
.sensor-metric { font-size: 26px; font-weight: 800; color: #38bdf8; margin: 4px 0; }
.status-bar {
  background: #0f172a;
  border-left: 4px solid #38bdf8;
  padding: 10px;
  border-radius: 6px;
  font-size: 13px;
  color: #e2e8f0;
  margin: 10px 0;
  text-align: left;
}
.temp-display { font-size: 46px; font-weight: 900; color: #facc15; margin: 8px 0; }
select {
  padding: 9px 12px;
  font-size: 14px;
  background: #0f172a;
  color: #fff;
  border: 1px solid #475569;
  border-radius: 8px;
  margin: 8px 0;
  width: 90%;
  max-width: 320px;
}
.pulse-tag { font-size: 12px; color: #94a3b8; margin-left: 4px; }
</style>
)=====";

void redirectHome() {
  server.sendHeader("Location", "/");
  server.send(303);
}

void handleRoot() {
  String html;
  html.reserve(7500);
  html += "<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1'>";
  if (learnTarget != LEARN_NONE) html += "<meta http-equiv='refresh' content='2'>";
  html += "<title>SEROS LAN Controller</title>";
  html += PAGE_STYLE;
  html += "</head><body><div class='container'>";

  // Header
  html += "<div class='header'><h1>S.E.R.O.S. LAN Controller</h1>";
  html += "<p>ESP32 Node &bull; " + WiFi.localIP().toString() + " &bull; RSSI: " + String(WiFi.RSSI()) + " dBm</p></div>";

  // Status Alert
  html += "<div class='status-bar'><strong>System:</strong> " + statusMessage + "</div>";

  // Card 1: Live Environmental Telemetry (HTU21DF)
  html += "<div class='card'><h2>Environmental Sensor</h2>";
  if (sensorAvailable) {
    float t = sensor.readTemperature();
    float h = sensor.readHumidity();
    html += "<div class='sensor-metric'>" + (isnan(t) ? "--" : String(t, 1)) + "&deg;C &nbsp;&bull;&nbsp; " +
            (isnan(h) ? "--" : String(h, 0)) + "% RH</div>";
    html += "<p style='color:#94a3b8;margin:2px 0 0;font-size:12px;'>Adafruit HTU21DF (I2C SDA=21, SCL=22)</p>";
  } else {
    html += "<div style='color:#f87171;font-size:14px;padding:8px;'>HTU21DF Sensor Offline (I2C Bus Ready)</div>";
  }
  html += "</div>";

  // Card 2: 4-Quadrant Relays
  html += "<div class='card'><h2>4-Quadrant Relays</h2>";
  html += "<div class='relay-grid'>";
  for (uint8_t i = 0; i < 4; ++i) {
    html += "<div class='relay-box'>";
    html += "<div class='relay-title'>Quadrant " + String(i + 1) + " (GPIO " + String(relayPins[i]) + ")</div>";
    html += "<div style='margin-bottom:8px;'><span class='badge " + String(relays[i] ? "badge-on'>ON" : "badge-off'>OFF") + "</span></div>";
    if (relays[i]) {
      html += "<a href='/relayToggle?id=" + String(i + 1) + "&state=0' class='btn btn-red'>Turn OFF</a>";
    } else {
      html += "<a href='/relayToggle?id=" + String(i + 1) + "&state=1' class='btn btn-green'>Turn ON</a>";
    }
    html += "</div>";
  }
  html += "</div>";
  html += "<div><a href='/relayAll?state=1' class='btn btn-green'>ALL ON</a>";
  html += "<a href='/relayAll?state=0' class='btn btn-red'>ALL OFF</a></div>";
  html += "</div>";

  // Card 3: Universal AC Remote Controller
  html += "<div class='card'><h2>Universal AC Remote</h2>";
  if (learnTarget == LEARN_AUTO) {
    html += "<div style='color:#fbbf24;font-weight:700;margin:10px 0;'>LISTENING FOR AC REMOTE (Press any button)...</div>";
    html += "<a href='/cancel' class='btn btn-slate'>CANCEL LEARNING</a>";
  } else {
    html += "<a href='/learn' class='btn btn-amber'>" + String(protocolReady ? "RE-LEARN REMOTE" : "LEARN REMOTE (AUTO-DETECT)") + "</a>";
  }

  // Manual Protocol Selection Dropdown
  html += "<form action='/setVendor' method='GET' style='margin-top:10px;'>";
  html += "<label style='font-size:13px;color:#94a3b8;'>Or Select Vendor Protocol Manually:</label><br>";
  html += "<select name='vendor' onchange='this.form.submit()'>";
  html += "<option value=''>-- Select AC Brand / Protocol --</option>";
  String currentProto = protocolReady ? typeToString(ac.next.protocol) : "";
  for (size_t i = 0; i < kVendorCount; i++) {
    html += "<option value='" + String(kVendors[i]) + "'";
    if (currentProto == kVendors[i]) html += " selected";
    html += ">" + String(kVendors[i]) + "</option>";
  }
  html += "</select></form>";

  // Active AC Control Pad
  if (protocolReady) {
    html += "<hr style='border:0;border-top:1px solid #334155;margin:16px 0;'>";
    html += "<div style='font-size:14px;color:#38bdf8;font-weight:600;'>Active Protocol: " + typeToString(ac.next.protocol) + "</div>";
    html += "<div class='temp-display'>" + String((int)ac.next.degrees) + "&deg;C</div>";

    html += "<div><a href='/temp?dir=down' class='btn btn-blue'>&minus; 1&deg;C</a>";
    html += "<a href='/temp?dir=up' class='btn btn-blue'>&#43; 1&deg;C</a></div>";

    html += "<div style='margin-top:8px;'>";
    html += "<a href='/power?on=1' class='btn btn-green'>POWER ON</a>";
    html += "<a href='/power?on=0' class='btn btn-red'>POWER OFF</a></div>";

    html += "<div style='font-size:13px;color:#94a3b8;margin:12px 0 6px;'>";
    html += "Mode: <strong style='color:#fff;'>" + modeToString(ac.next.mode) + "</strong> &bull; ";
    html += "Fan: <strong style='color:#fff;'>" + fanToString(ac.next.fanspeed) + "</strong> &bull; ";
    html += "Power: <strong style='color:#fff;'>" + String(ac.next.power ? "ON" : "OFF") + "</strong></div>";

    html += "<div><a href='/mode?m=cool' class='btn btn-slate'>Cool</a>";
    html += "<a href='/mode?m=heat' class='btn btn-slate'>Heat</a>";
    html += "<a href='/mode?m=dry' class='btn btn-slate'>Dry</a>";
    html += "<a href='/mode?m=fan' class='btn btn-slate'>Fan</a>";
    html += "<a href='/mode?m=auto' class='btn btn-slate'>Auto</a></div>";

    html += "<div style='margin-top:6px;'><a href='/fan?f=auto' class='btn btn-slate'>Fan Auto</a>";
    html += "<a href='/fan?f=low' class='btn btn-slate'>Low</a>";
    html += "<a href='/fan?f=medium' class='btn btn-slate'>Med</a>";
    html += "<a href='/fan?f=high' class='btn btn-slate'>High</a></div>";

    html += "<div style='margin-top:12px;'><a href='/send' class='btn btn-cyan'>RESEND CURRENT STATE</a></div>";
  }
  html += "</div>";

  // Card 4: Raw Record / Replay Slots (Fallback)
  html += "<div class='card'><h2>Raw IR Replay Slots (Fallback)</h2>";
  html += "<p style='font-size:12px;color:#94a3b8;margin:0 0 10px;'>Capture any unknown button pulse-for-pulse directly.</p>";
  for (uint8_t i = 0; i < kRawSlots; i++) {
    html += "<div style='display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #334155;'>";
    html += "<span style='font-size:13px;font-weight:600;'>Slot " + String(i + 1) + ": ";
    if (rawLengths[i] > 0) {
      html += "<span class='pulse-tag'>(" + String(rawLengths[i]) + " pulses)</span>";
    } else {
      html += "<span class='pulse-tag'>(empty)</span>";
    }
    html += "</span><div>";
    html += "<a href='/learnRaw?slot=" + String(i) + "' class='btn btn-amber' style='padding:6px 10px;font-size:12px;'>Record</a>";
    if (rawLengths[i] > 0) {
      html += "<a href='/sendRaw?slot=" + String(i) + "' class='btn btn-green' style='padding:6px 10px;font-size:12px;'>Send</a>";
    }
    html += "</div></div>";
  }
  html += "</div>";

  // Footer & REST API Info
  html += "<p style='font-size:11px;color:#64748b;'>REST API Active on /api/status &bull; /api/relay &bull; /api/ac/*</p>";
  html += "</div></body></html>";

  server.send(200, "text/html", html);
}

// ================= BROWSER REDIRECT ACTION HANDLERS =================
void handleLearn()    { startLearn(LEARN_AUTO); redirectHome(); }
void handleCancel()   { stopLearn(); statusMessage = "Learning cancelled."; redirectHome(); }

void handleLearnRaw() {
  int slot = server.arg("slot").toInt();
  if (slot >= 0 && slot < kRawSlots) startLearn(slot + 1);
  redirectHome();
}

void handleSendRaw() {
  int slot = server.arg("slot").toInt();
  if (slot >= 0 && slot < kRawSlots && rawLengths[slot] > 0) {
    if (learnTarget != LEARN_NONE) stopLearn();
    irsend.sendRaw(rawSlots[slot], rawLengths[slot], 38);
    statusMessage = "Sent raw IR slot " + String(slot + 1) + ".";
    Serial.println("[IR] " + statusMessage);
  } else {
    statusMessage = "Raw slot is empty.";
  }
  redirectHome();
}

void handleSetVendor() {
  String name = server.arg("vendor");
  decode_type_t p = strToDecodeType(name.c_str());
  if (p != decode_type_t::UNKNOWN && IRac::isProtocolSupported(p)) {
    ac.next.protocol = p;
    ac.next.model    = -1;
    ac.next.power    = true;
    ac.next.mode     = stdAc::opmode_t::kCool;
    protocolReady = true;
    statusMessage = "Protocol set: " + typeToString(p) + ". Test with POWER ON or Temp.";
    Serial.println("[IR] " + statusMessage);
  } else if (name.length() > 0) {
    statusMessage = "Vendor protocol not supported: " + name;
  }
  redirectHome();
}

void handleTemp() {
  if (protocolReady) {
    String dir = server.arg("dir");
    if (dir == "up"   && ac.next.degrees < 30) ac.next.degrees++;
    if (dir == "down" && ac.next.degrees > 16) ac.next.degrees--;
    ac.next.power = true;
    sendState();
  }
  redirectHome();
}

void handlePower() {
  if (protocolReady) {
    ac.next.power = (server.arg("on") == "1");
    if (ac.next.mode == stdAc::opmode_t::kOff) ac.next.mode = stdAc::opmode_t::kCool;
    sendState();
  }
  redirectHome();
}

void handleMode() {
  if (protocolReady) {
    String m = server.arg("m");
    if      (m == "cool") ac.next.mode = stdAc::opmode_t::kCool;
    else if (m == "heat") ac.next.mode = stdAc::opmode_t::kHeat;
    else if (m == "dry")  ac.next.mode = stdAc::opmode_t::kDry;
    else if (m == "fan")  ac.next.mode = stdAc::opmode_t::kFan;
    else if (m == "auto") ac.next.mode = stdAc::opmode_t::kAuto;
    ac.next.power = true;
    sendState();
  }
  redirectHome();
}

void handleFan() {
  if (protocolReady) {
    String f = server.arg("f");
    if      (f == "auto")   ac.next.fanspeed = stdAc::fanspeed_t::kAuto;
    else if (f == "low")    ac.next.fanspeed = stdAc::fanspeed_t::kLow;
    else if (f == "medium") ac.next.fanspeed = stdAc::fanspeed_t::kMedium;
    else if (f == "high")   ac.next.fanspeed = stdAc::fanspeed_t::kHigh;
    sendState();
  }
  redirectHome();
}

void handleSend() {
  sendState();
  redirectHome();
}

void handleRelayToggle() {
  int id = server.arg("id").toInt() - 1;
  int state = server.arg("state").toInt();
  if (id >= 0 && id < 4) {
    setRelay(id, state == 1);
  }
  redirectHome();
}

void handleRelayAll() {
  int state = server.arg("state").toInt();
  for (uint8_t i = 0; i < 4; ++i) setRelay(i, state == 1);
  redirectHome();
}

// ================= REST API HANDLERS =================
void handleApiStatus() {
  cors();
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
  server.send(200, "application/json", statusJson());
}

void handleApiRelay() {
  cors();
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }

  int id = -1;
  int state = -1;

  if (server.hasArg("id")) id = server.arg("id").toInt() - 1;
  else if (server.hasArg("relay")) id = server.arg("relay").toInt() - 1;

  if (server.hasArg("state")) state = server.arg("state").toInt();
  else if (server.hasArg("on")) state = (server.arg("on") == "true" || server.arg("on") == "1") ? 1 : 0;

  // Check JSON body if parameters not in query string
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
}

void handleApiAll() {
  cors();
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
  int state = server.arg("state").toInt();
  for (uint8_t i = 0; i < 4; ++i) setRelay(i, state == 1);
  server.send(200, "application/json", "{\"status\":\"ok\",\"all_state\":" + String(state) + "}");
}

void handleApiAcLearn() {
  cors();
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
  startLearn(LEARN_AUTO);
  server.send(200, "application/json", "{\"status\":\"learning\",\"target\":\"auto\"}");
}

void handleApiAcCancel() {
  cors();
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
  stopLearn();
  statusMessage = "Learning cancelled.";
  server.send(200, "application/json", "{\"status\":\"cancelled\"}");
}

void handleApiAcRawLearn() {
  cors();
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
  int slot = server.arg("slot").toInt();
  if (slot < 1 || slot > 4) {
    server.send(400, "application/json", "{\"error\":\"slot must be 1-4\"}");
    return;
  }
  startLearn(slot);
  server.send(200, "application/json", "{\"status\":\"learning\",\"slot\":" + String(slot) + "}");
}

void handleApiAcRawSend() {
  cors();
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
  int slot = server.arg("slot").toInt() - 1;
  if (slot < 0 || slot >= kRawSlots || rawLengths[slot] == 0) {
    server.send(400, "application/json", "{\"error\":\"slot empty or invalid\"}");
    return;
  }
  if (learnTarget != LEARN_NONE) stopLearn();
  irsend.sendRaw(rawSlots[slot], rawLengths[slot], 38);
  server.send(200, "application/json", "{\"status\":\"ok\",\"sent_slot\":" + String(slot + 1) + "}");
}

void handleApiAcVendor() {
  cors();
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
  String vendor = server.arg("vendor");
  if (vendor.length() == 0 && server.hasArg("plain")) {
    String body = server.arg("plain");
    int idx = body.indexOf("\"vendor\":\"");
    if (idx != -1) {
      int endIdx = body.indexOf("\"", idx + 10);
      if (endIdx != -1) vendor = body.substring(idx + 10, endIdx);
    }
  }

  decode_type_t p = strToDecodeType(vendor.c_str());
  if (p != decode_type_t::UNKNOWN && IRac::isProtocolSupported(p)) {
    ac.next.protocol = p;
    ac.next.model    = -1;
    ac.next.power    = true;
    ac.next.mode     = stdAc::opmode_t::kCool;
    protocolReady = true;
    statusMessage = "Protocol set: " + typeToString(p);
    server.send(200, "application/json", statusJson());
  } else {
    server.send(400, "application/json", "{\"error\":\"unsupported or unknown vendor protocol\"}");
  }
}

void handleApiAcPower() {
  cors();
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
  if (!protocolReady) {
    server.send(409, "application/json", "{\"error\":\"AC protocol not learned or selected\"}");
    return;
  }
  String onArg = server.arg("on");
  if (server.hasArg("power")) onArg = server.arg("power");
  ac.next.power = (onArg == "1" || onArg == "true");
  if (ac.next.mode == stdAc::opmode_t::kOff) ac.next.mode = stdAc::opmode_t::kCool;
  sendState();
  server.send(200, "application/json", statusJson());
}

void handleApiAcTemp() {
  cors();
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
  if (!protocolReady) {
    server.send(409, "application/json", "{\"error\":\"AC protocol not learned or selected\"}");
    return;
  }
  int t = server.arg("value").toInt();
  if (t == 0 && server.hasArg("temp")) t = server.arg("temp").toInt();
  ac.next.degrees = constrain(t, 16, 30);
  ac.next.power   = true;
  sendState();
  server.send(200, "application/json", statusJson());
}

void handleApiAcMode() {
  cors();
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
  if (!protocolReady) {
    server.send(409, "application/json", "{\"error\":\"AC protocol not learned or selected\"}");
    return;
  }
  String mode = server.arg("mode");
  if      (mode == "cool") ac.next.mode = stdAc::opmode_t::kCool;
  else if (mode == "heat") ac.next.mode = stdAc::opmode_t::kHeat;
  else if (mode == "dry")  ac.next.mode = stdAc::opmode_t::kDry;
  else if (mode == "fan")  ac.next.mode = stdAc::opmode_t::kFan;
  else if (mode == "auto") ac.next.mode = stdAc::opmode_t::kAuto;
  else {
    server.send(400, "application/json", "{\"error\":\"unsupported mode\"}");
    return;
  }
  ac.next.power = true;
  sendState();
  server.send(200, "application/json", statusJson());
}

void handleApiAcFan() {
  cors();
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
  if (!protocolReady) {
    server.send(409, "application/json", "{\"error\":\"AC protocol not learned or selected\"}");
    return;
  }
  String fan = server.arg("fan");
  if      (fan == "auto")   ac.next.fanspeed = stdAc::fanspeed_t::kAuto;
  else if (fan == "low")    ac.next.fanspeed = stdAc::fanspeed_t::kLow;
  else if (fan == "medium") ac.next.fanspeed = stdAc::fanspeed_t::kMedium;
  else if (fan == "high")   ac.next.fanspeed = stdAc::fanspeed_t::kHigh;
  else {
    server.send(400, "application/json", "{\"error\":\"unsupported fan speed\"}");
    return;
  }
  sendState();
  server.send(200, "application/json", statusJson());
}

void handleApiAcSend() {
  cors();
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
  sendState();
  server.send(200, "application/json", statusJson());
}

// ================= ARDUINO SETUP =================
void setup() {
  Serial.begin(115200);
  delay(150);
  Serial.println("\n=======================================================");
  Serial.println("  S.E.R.O.S. ESP32 LAN Controller & Universal AC Remote ");
  Serial.println("=======================================================");

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

  // IR Remote Initialization
  setupAcDefaults();
  irsend.begin();
  irrecv.setUnknownThreshold(kMinUnknownSize);
  irrecv.enableIRIn(); // Arm IR receiver continuously on GPIO 14 for remote manual override
  Serial.println("[SEROS] IR Receiver armed on GPIO 14 (Mini Remote Manual Override Active)");

  // Connect to Wi-Fi with Static IP configuration
  WiFi.mode(WIFI_STA);

  IPAddress local_IP(192, 168, 137, 97);
  IPAddress gateway(192, 168, 137, 1);
  IPAddress subnet(255, 255, 255, 0);
  IPAddress primaryDNS(8, 8, 8, 8);
  if (!WiFi.config(local_IP, gateway, subnet, primaryDNS)) {
    Serial.println("[SEROS] Failed to configure Static IP");
  }

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("[SEROS] Connecting to Wi-Fi '%s' (Static IP: 192.168.137.97)...", WIFI_SSID);
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
    delay(250);
    Serial.print(".");
  }

  // Fallback to DHCP if static IP is not accepted by Windows Mobile Hotspot
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n[SEROS] Static IP timed out. Attempting DHCP connection...");
    WiFi.disconnect();
    delay(400);
    WiFi.config(INADDR_NONE, INADDR_NONE, INADDR_NONE); // Force DHCP
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    started = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
      delay(250);
      Serial.print(".");
    }
  }

  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[SEROS] Wi-Fi Connected! IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.printf("[SEROS] Browser Dashboard: http://%s/\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("[SEROS] ⚠️ Wi-Fi connection timed out. Will auto-retry in loop.");
    Serial.println("[SEROS] 💡 NOTE: In Windows Mobile Hotspot settings, ensure 'Network band' is set to '2.4 GHz' (ESP32 only supports 2.4 GHz).");
  }

  // ---------------- Web Server Routing ----------------
  server.onNotFound([]() {
    cors();
    if (server.method() == HTTP_OPTIONS) {
      server.send(204);
    } else {
      server.send(404, "application/json", "{\"error\":\"Endpoint not found\"}");
    }
  });

  // 1. Browser HTML Dashboard & Actions
  server.on("/", HTTP_GET, handleRoot);
  server.on("/learn", HTTP_ANY, handleLearn);
  server.on("/cancel", HTTP_ANY, handleCancel);
  server.on("/learnRaw", HTTP_ANY, handleLearnRaw);
  server.on("/sendRaw", HTTP_ANY, handleSendRaw);
  server.on("/setVendor", HTTP_ANY, handleSetVendor);
  server.on("/temp", HTTP_ANY, handleTemp);
  server.on("/power", HTTP_ANY, handlePower);
  server.on("/mode", HTTP_ANY, handleMode);
  server.on("/fan", HTTP_ANY, handleFan);
  server.on("/send", HTTP_ANY, handleSend);
  server.on("/relayToggle", HTTP_ANY, handleRelayToggle);
  server.on("/relayAll", HTTP_ANY, handleRelayAll);

  // 2. REST API Endpoints (with and without trailing slashes for full web & mobile app compatibility)
  server.on("/api/status", HTTP_ANY, handleApiStatus);
  server.on("/api/status/", HTTP_ANY, handleApiStatus);

  server.on("/api/relay", HTTP_ANY, handleApiRelay);
  server.on("/api/relay/", HTTP_ANY, handleApiRelay);

  server.on("/api/all", HTTP_ANY, handleApiAll);
  server.on("/api/all/", HTTP_ANY, handleApiAll);

  server.on("/api/ac/learn", HTTP_ANY, handleApiAcLearn);
  server.on("/api/ac/learn/", HTTP_ANY, handleApiAcLearn);

  server.on("/api/ac/cancel", HTTP_ANY, handleApiAcCancel);
  server.on("/api/ac/cancel/", HTTP_ANY, handleApiAcCancel);

  server.on("/api/ac/raw-learn", HTTP_ANY, handleApiAcRawLearn);
  server.on("/api/ac/raw-learn/", HTTP_ANY, handleApiAcRawLearn);

  server.on("/api/ac/raw-send", HTTP_ANY, handleApiAcRawSend);
  server.on("/api/ac/raw-send/", HTTP_ANY, handleApiAcRawSend);

  server.on("/api/ac/vendor", HTTP_ANY, handleApiAcVendor);
  server.on("/api/ac/vendor/", HTTP_ANY, handleApiAcVendor);

  server.on("/api/ac/power", HTTP_ANY, handleApiAcPower);
  server.on("/api/ac/power/", HTTP_ANY, handleApiAcPower);

  server.on("/api/ac/temp", HTTP_ANY, handleApiAcTemp);
  server.on("/api/ac/temp/", HTTP_ANY, handleApiAcTemp);

  server.on("/api/ac/mode", HTTP_ANY, handleApiAcMode);
  server.on("/api/ac/mode/", HTTP_ANY, handleApiAcMode);

  server.on("/api/ac/fan", HTTP_ANY, handleApiAcFan);
  server.on("/api/ac/fan/", HTTP_ANY, handleApiAcFan);

  server.on("/api/ac/send", HTTP_ANY, handleApiAcSend);
  server.on("/api/ac/send/", HTTP_ANY, handleApiAcSend);

  server.begin();
  Serial.println("[SEROS] HTTP Server listening on port 80");
}

// ================= MAIN LOOP =================
void loop() {
  // Non-blocking WiFi reconnect monitor (rate-limited to 10s to avoid watchdog resets)
  static unsigned long lastWifiCheck = 0;
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastWifiCheck > 10000) {
      lastWifiCheck = millis();
      Serial.println("[SEROS] Wi-Fi lost. Attempting reconnection...");
      WiFi.reconnect();
    }
  }

  server.handleClient();
  checkIRReceiver();
}
