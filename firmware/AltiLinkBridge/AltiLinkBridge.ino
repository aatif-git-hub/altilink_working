#include <Arduino.h>
#include <SPI.h>
#include <RadioLib.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>

#define GROUP_ID "ALT-NXZD"
#define MEMBER_ID "M02"

#define LORA_FREQUENCY_MHZ 866.0f
#define LORA_CS 8
#define LORA_DIO1 14
#define LORA_RST 12
#define LORA_BUSY 13
#define LORA_SCK 9
#define LORA_MISO 11
#define LORA_MOSI 10

#define GPS_RX_PIN 20
#define GPS_BAUD 9600

#define SOS_BUTTON_PIN 6
#define BUTTON_DEBOUNCE_MS 40
#define POSITION_INTERVAL_MS 5000

SX1262 radio = new Module(
  LORA_CS,
  LORA_DIO1,
  LORA_RST,
  LORA_BUSY
);

TinyGPSPlus gps;
HardwareSerial gpsSerial(1);

bool radioReady = false;
bool haveSavedLocation = false;

double savedLatitude = 0;
double savedLongitude = 0;

uint32_t savedLocationAt = 0;
uint32_t coordinateNumber = 0;
uint32_t lastGpsMessageAt = 0;

String bootId;
uint32_t packetSequence = 0;
uint32_t positionSequence = 0;

uint32_t lastPositionAt = 0;
uint32_t nextPositionDelay = POSITION_INTERVAL_MS;

int lastButtonReading = HIGH;
int stableButtonState = HIGH;
uint32_t buttonChangedAt = 0;

void printSavedLocation() {
  Serial.print(savedLatitude, 6);
  Serial.print(", ");
  Serial.println(savedLongitude, 6);
}

void readGPS() {
  while (gpsSerial.available()) {
    bool sentenceComplete = gps.encode(gpsSerial.read());

    if (
      sentenceComplete
      && gps.location.isUpdated()
      && gps.location.isValid()
    ) {
      uint32_t fixAge = gps.location.age();

      savedLatitude = gps.location.lat();
      savedLongitude = gps.location.lng();

      savedLocationAt = millis() - fixAge;
      haveSavedLocation = true;
      coordinateNumber++;

      Serial.print("GPS coord ");
      Serial.print(coordinateNumber);
      Serial.print(": ");
      printSavedLocation();

      lastGpsMessageAt = millis();
    }
  }
}

void reportGPSStatus() {
  uint32_t now = millis();

  if (now - lastGpsMessageAt < 2000) {
    return;
  }

  lastGpsMessageAt = now;

  if (haveSavedLocation) {
    Serial.print("No new GPS coordinate. Keeping coord ");
    Serial.print(coordinateNumber);

    Serial.print(" | Age: ");
    Serial.print((now - savedLocationAt) / 1000);
    Serial.println(" seconds");
  } else {
    Serial.print("Waiting for first valid GPS coordinate");

    Serial.print(" | GPS characters: ");
    Serial.print(gps.charsProcessed());

    Serial.print(" | Satellites: ");

    if (gps.satellites.isValid()) {
      Serial.println(gps.satellites.value());
    } else {
      Serial.println("unknown");
    }
  }
}

void sendPacket(const char* type) {
  readGPS();

  if (!radioReady) {
    Serial.println("Cannot send: LoRa is not ready");
    return;
  }

  bool isSOS = strcmp(type, "sos") == 0;

  uint32_t locationAgeSeconds = 0;

  if (haveSavedLocation) {
    locationAgeSeconds =
      (millis() - savedLocationAt) / 1000;
  }

  JsonDocument packet;

  packet["v"] = 1;
  packet["type"] = type;
  packet["group"] = GROUP_ID;
  packet["from"] = MEMBER_ID;
  packet["boot"] = bootId;
  packet["seq"] = ++packetSequence;

  packet["fix"] = haveSavedLocation;

  if (!isSOS) {
    packet["ps"] = ++positionSequence;
  }

  if (haveSavedLocation) {
    packet["lat"] = savedLatitude;
    packet["lon"] = savedLongitude;

    if (isSOS) {
      packet["gpsAgeSec"] = locationAgeSeconds;
      packet["coordNum"] = coordinateNumber;
    }
  }

  String payload;
  serializeJson(packet, payload);

  if (payload.length() > 255) {
    Serial.println("Cannot send: packet exceeds 255 bytes");
    return;
  }

  Serial.println();

  if (isSOS) {
    if (haveSavedLocation) {
      Serial.print("Sending last coord ");
      Serial.print(coordinateNumber);
      Serial.print(": ");
      printSavedLocation();

      Serial.print("Location age: ");
      Serial.print(locationAgeSeconds);
      Serial.println(" seconds");
    } else {
      Serial.println(
        "No GPS coordinate saved yet. Sending SOS without location."
      );
    }
  } else {
    Serial.print("Sending GPS position coord ");
    Serial.println(coordinateNumber);
  }

  Serial.print("Packet: ");
  Serial.println(payload);

  int16_t state = radio.transmit(payload);

  Serial.print("LoRa transmit result: ");
  Serial.println(state);

  if (state == RADIOLIB_ERR_NONE) {
    Serial.println(
      "Transmission completed. Check receiver for delivery."
    );
  } else {
    Serial.println("Transmission failed");
  }

  Serial.println();
}

void checkButton() {
  uint32_t now = millis();
  int reading = digitalRead(SOS_BUTTON_PIN);

  if (reading != lastButtonReading) {
    lastButtonReading = reading;
    buttonChangedAt = now;
  }

  if (
    now - buttonChangedAt >= BUTTON_DEBOUNCE_MS
    && reading != stableButtonState
  ) {
    stableButtonState = reading;

    if (stableButtonState == LOW) {
      Serial.println();
      Serial.println("SOS button pressed");

      sendPacket("sos");

      lastPositionAt = millis();
      nextPositionDelay =
        POSITION_INTERVAL_MS + esp_random() % 1200;
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);

  lastButtonReading = digitalRead(SOS_BUTTON_PIN);
  stableButtonState = lastButtonReading;
  buttonChangedAt = millis();

  gpsSerial.begin(
    GPS_BAUD,
    SERIAL_8N1,
    GPS_RX_PIN,
    -1
  );

  SPI.begin(
    LORA_SCK,
    LORA_MISO,
    LORA_MOSI,
    LORA_CS
  );

  int16_t state = radio.begin(
    LORA_FREQUENCY_MHZ,
    125.0,
    7,
    5,
    0x12,
    10,
    8,
    1.8,
    false
  );

  radioReady = state == RADIOLIB_ERR_NONE;
  bootId = String(esp_random(), HEX);

  Serial.println();
  Serial.println("ALTiLink last-known GPS SOS sender");

  Serial.print("Group: ");
  Serial.println(GROUP_ID);

  Serial.print("Member: ");
  Serial.println(MEMBER_ID);

  Serial.print("Radio begin: ");
  Serial.println(state);

  if (radioReady) {
    Serial.println("LoRa ready at 866 MHz");
  } else {
    Serial.println("LoRa initialization failed");
  }

  Serial.println("GPS TX: GPIO20");
  Serial.println("Button: GPIO6 to GND");
  Serial.println("Waiting for first valid GPS coordinate");

  lastPositionAt = millis();
  nextPositionDelay =
    POSITION_INTERVAL_MS + esp_random() % 1200;
}

void loop() {
  readGPS();
  checkButton();
  reportGPSStatus();

  uint32_t now = millis();

  bool locationIsRecent =
    haveSavedLocation
    && now - savedLocationAt < 10000;

  if (
    radioReady
    && locationIsRecent
    && now - lastPositionAt >= nextPositionDelay
  ) {
    sendPacket("position");

    lastPositionAt = millis();
    nextPositionDelay =
      POSITION_INTERVAL_MS + esp_random() % 1200;
  }

  delay(1);
}