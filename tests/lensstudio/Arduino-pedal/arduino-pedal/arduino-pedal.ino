//#include "Keyboard.h"
const int upButton = 2;
bool lastButtonState = HIGH;

void setup() {
  Serial.begin(9600);
  pinMode(upButton, INPUT);
  //Keyboard.begin();
}

void loop() {
  bool buttonState = digitalRead(upButton);

  if (digitalRead(upButton) == HIGH && buttonState == LOW) {
    Serial.println("1");
    delay(50); // small debounce
  } 

  lastButtonState = buttonState;
}