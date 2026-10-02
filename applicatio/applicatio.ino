#include <AFMotor.h>

// Motors connected to the Adafruit Motor Shield
AF_DCMotor pump(1);   // M1 - 9V water pump
AF_DCMotor motor2(2); // M2 - small motor

// LEDs
const uint8_t LED1 = A0;
const uint8_t LED2 = A1;

void allOff() {
  digitalWrite(LED1, LOW);
  digitalWrite(LED2, LOW);
  pump.run(RELEASE);
  motor2.run(RELEASE);
}

void allOn() {
  digitalWrite(LED1, HIGH);
  digitalWrite(LED2, HIGH);
  pump.setSpeed(255);
  pump.run(FORWARD);
  motor2.setSpeed(120);
  motor2.run(FORWARD);
}

void handleCommand(String command) {
  command.trim();

  if (command.length() == 0) {
    return;
  }

  // New single-character protocol.
  if (command == "1") {
    digitalWrite(LED1, HIGH);
    Serial.println("LED 1 ON");
  } else if (command == "0") {
    digitalWrite(LED1, LOW);
    Serial.println("LED 1 OFF");
  } else if (command == "2") {
    digitalWrite(LED2, HIGH);
    Serial.println("LED 2 ON");
  } else if (command == "3") {
    digitalWrite(LED2, LOW);
    Serial.println("LED 2 OFF");
  } else if (command == "P") {
    pump.setSpeed(255);
    pump.run(FORWARD);
    Serial.println("WATER PUMP ON");
  } else if (command == "p") {
    pump.run(RELEASE);
    Serial.println("WATER PUMP OFF");
  } else if (command == "M") {
    motor2.setSpeed(120);
    motor2.run(FORWARD);
    Serial.println("MOTOR 2 ON");
  } else if (command == "m") {
    motor2.run(RELEASE);
    Serial.println("MOTOR 2 OFF");
  } else if (command == "A") {
    allOn();
    Serial.println("ALL ON");
  } else if (command == "X") {
    allOff();
    Serial.println("ALL OFF");
  }
  // Keep compatibility with the backend's existing word commands.
  else if (command == "left") {
    digitalWrite(LED1, HIGH);
    digitalWrite(LED2, LOW);
    pump.setSpeed(255);
    pump.run(FORWARD);
    motor2.run(RELEASE);
    Serial.println("LEFT: WATER PUMP ON");
  } else if (command == "right") {
    digitalWrite(LED1, LOW);
    digitalWrite(LED2, HIGH);
    pump.run(RELEASE);
    motor2.setSpeed(120);
    motor2.run(FORWARD);
    Serial.println("RIGHT: MOTOR 2 ON");
  } else if (command == "both") {
    allOn();
    Serial.println("BOTH MOTORS ON");
  } else if (command == "off") {
    allOff();
    Serial.println("ALL OFF");
  } else {
    Serial.print("INVALID COMMAND: ");
    Serial.println(command);
  }
}

void setup() {
  Serial.begin(9600);

  pinMode(LED1, OUTPUT);
  pinMode(LED2, OUTPUT);

  pump.setSpeed(255);
  motor2.setSpeed(120);
  allOff();

  Serial.println("SYSTEM READY");
  Serial.println("1/0 = LED1 ON/OFF");
  Serial.println("2/3 = LED2 ON/OFF");
  Serial.println("P/p = WATER PUMP ON/OFF");
  Serial.println("M/m = MOTOR 2 ON/OFF");
  Serial.println("A = ALL ON, X = ALL OFF");
}

void loop() {
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    handleCommand(command);
  }
}
