#include <Servo.h>

#define RELAY_FRONT 7
#define RELAY_BACK  8
#define SERVO_PIN   9

Servo myServo;

void setup() {
  Serial.begin(9600);

  pinMode(RELAY_FRONT, OUTPUT);
  pinMode(RELAY_BACK, OUTPUT);

  myServo.attach(SERVO_PIN);
  
  // OFF initially
  // RELAY_FRONT is assumed active HIGH (LOW = OFF)
  // RELAY_BACK is assumed active HIGH (LOW = OFF)
  digitalWrite(RELAY_FRONT, LOW);//this is older version of the relay it has reverse logic of working
  digitalWrite(RELAY_BACK, HIGH);//this is newer version of relay, setting LOW to turn OFF
  
  myServo.write(90); // 90 = OPEN initially

  Serial.println("ARDUINO READY");
  Serial.println("Type: left / right / both / off");
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    Serial.print("Command: ");
    Serial.println(cmd);

    if (cmd == "left") {
      Serial.println("LEFT MODE");
      digitalWrite(RELAY_FRONT, HIGH); // FRONT ON
      digitalWrite(RELAY_BACK, LOW);   // BACK OFF
      myServo.write(0);                // CLOSE window
    }
    else if (cmd == "right") {
      Serial.println("RIGHT MODE");
      digitalWrite(RELAY_FRONT, LOW);  // FRONT OFF
      digitalWrite(RELAY_BACK, HIGH);  // BACK ON (active HIGH)
      myServo.write(0);                // CLOSE window
    }
    else if (cmd == "both") {
      Serial.println("BOTH MODE");
      digitalWrite(RELAY_FRONT, HIGH); // FRONT ON
      digitalWrite(RELAY_BACK, HIGH);  // BACK ON
      myServo.write(0);                // CLOSE window
    }
    else if (cmd == "off") {
      Serial.println("ALL OFF");
      digitalWrite(RELAY_FRONT, LOW);  // FRONT OFF
      digitalWrite(RELAY_BACK, LOW);   // BACK OFF
      myServo.write(90);               // OPEN window
    }
    else {
      Serial.println("Invalid command");
    }
  }
}