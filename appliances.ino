#define RELAY_FRONT 7
#define RELAY_BACK  8

void setup() {
  Serial.begin(9600);

  pinMode(RELAY_FRONT, OUTPUT);
  pinMode(RELAY_BACK, OUTPUT);

  // OFF initially (active LOW relay)
  digitalWrite(RELAY_FRONT,LOW );
  digitalWrite(RELAY_BACK, HIGH);

  Serial.println("ARDUINO READY");
  Serial.println("Type: left / right / both / off");
}

void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    Serial.print("Command: ");
    Serial.println(cmd);

    // RESET (OFF)
    digitalWrite(RELAY_FRONT, LOW);
    digitalWrite(RELAY_BACK, HIGH);

    if (cmd == "left") {
      Serial.println("LEFT MODE");
      digitalWrite(RELAY_FRONT, HIGH);   // ✅ FIXED (ON = LOW)
    }

    else if (cmd == "right") {
      Serial.println("RIGHT MODE");
      digitalWrite(RELAY_BACK, LOW);
    }

    else if (cmd == "both") {
      Serial.println("BOTH MODE");
      digitalWrite(RELAY_FRONT, HIGH);
      digitalWrite(RELAY_BACK, LOW);
    }

    else if (cmd == "off") {
      Serial.println("ALL OFF");
    }

    else {
      Serial.println("Invalid command");
    }
  }
}