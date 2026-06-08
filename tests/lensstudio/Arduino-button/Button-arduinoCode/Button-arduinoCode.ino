const int buttonPin = 2;

bool lastButtonState = HIGH;

void setup() {
  Serial.begin(9600);
  pinMode(buttonPin, INPUT_PULLUP);
}

void loop() {
  bool buttonState = digitalRead(buttonPin);

  // Button press detected: HIGH -> LOW
  if (lastButtonState == HIGH && buttonState == LOW) {
    Serial.println("1");
    delay(50); // small debounce
  }

  lastButtonState = buttonState;
}