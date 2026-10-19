#include <Arduino.h>
#include <SPI.h>
#include <RadioLib.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>

#define GROUP_ID "ALT-9C3X"
#define MEMBER_ID "M02"

// LoRa configuration
#define LORA_FREQUENCY_MHZ 866.0f
#define LORA_CS 8
#define LORA_DIO1 14
#define LORA_RST 12
#define LORA_BUSY 13
#define LORA_SCK 9
#define LORA_MISO 11
#define LORA_MOSI 10

// GPS configuration
#define GPS_RX_PIN 20
#define GPS_BAUD 9600

// SOS button
#define SOS_BUTTON_PIN 6
#define BUTTON_DEBOUNCE_MS 40

// Position transmission interval
#define POSITION_INTERVAL_MS 15000

// Fake GPS for demonstration
#define USE_FAKE_GPS true
#define FAKE_LATITUDE 12.7516
#define FAKE_LONGITUDE 80.1950

// LoRa radio
SX1262 radio = new Module(
  LORA_CS,
  LORA_DIO1,
  LORA_RST,
  LORA_BUSY
);

// GPS
TinyGPSPlus gps;
HardwareSerial gpsSerial(1);

// System status
bool radioReady = false;
bool haveSavedLocation = false;

// Saved coordinates
double savedLatitude = 0;
double savedLongitude = 0;

uint32_t savedLocationAt = 0;
uint32_t coordinateNumber = 0;
uint32_t lastGpsMessageAt = 0;

// Packet identifiers
String bootId;
uint32_t packetSequence = 0;
uint32_t positionSequence = 0;

// Position transmission timing
uint32_t lastPositionAt = 0;
uint32_t nextPositionDelay = POSITION_INTERVAL_MS;

// Button debounce state
int lastButtonReading = HIGH;
int stableButtonState = HIGH;
uint32_t buttonChangedAt = 0;


// --------------------------------------------------
// PRINT SAVED COORDINATES
// --------------------------------------------------

void printSavedLocation() {
  Serial.print(savedLatitude, 6);
  Serial.print(", ");
  Serial.println(savedLongitude, 6);
}


// --------------------------------------------------
// USE FAKE GPS WHEN NO REAL FIX HAS BEEN SAVED
// --------------------------------------------------

void useFakeGPS() {
  if (USE_FAKE_GPS && !haveSavedLocation) {
    savedLatitude = FAKE_LATITUDE;
    savedLongitude = FAKE_LONGITUDE;

    savedLocationAt = millis();
    haveSavedLocation = true;

    coordinateNumber++;

    Serial.println();
    Serial.println("Using SIMULATED GPS coordinate");

    Serial.print("Latitude: ");
    Serial.println(savedLatitude, 6);

    Serial.print("Longitude: ");
    Serial.println(savedLongitude, 6);

    Serial.println("This is not a verified live GPS fix.");
    Serial.println();
  }
}


// --------------------------------------------------
// READ REAL GPS DATA
// --------------------------------------------------

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

      Serial.print("Real GPS coordinate ");
      Serial.print(coordinateNumber);
      Serial.print(": ");

      printSavedLocation();

      lastGpsMessageAt = millis();
    }
  }
}


// --------------------------------------------------
// GPS STATUS EVERY 15 SECONDS
// --------------------------------------------------

void reportGPSStatus() {
  uint32_t now = millis();

  if (now - lastGpsMessageAt < 15000) {
    return;
  }

  lastGpsMessageAt = now;

  if (haveSavedLocation) {
    Serial.print("Saved coordinate ");
    Serial.print(coordinateNumber);

    Serial.print(" | Latitude: ");
    Serial.print(savedLatitude, 6);

    Serial.print(" | Longitude: ");
    Serial.print(savedLongitude, 6);

    Serial.print(" | Age: ");
    Serial.print((now - savedLocationAt) / 1000);

    Serial.println(" seconds");
  } else {
    Serial.print("Waiting for GPS | Characters: ");
    Serial.print(gps.charsProcessed());

    Serial.print(" | Satellites: ");

    if (gps.satellites.isValid()) {
      Serial.println(gps.satellites.value());
    } else {
      Serial.println("unknown");
    }
  }
}


// --------------------------------------------------
// SEND LORA PACKET
// --------------------------------------------------

void sendPacket(const char* type) {
  // Read any available real GPS data
  readGPS();

  // Use simulated coordinates if no real fix exists
  useFakeGPS();

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

  // Serialize JSON
  String payload;
  serializeJson(packet, payload);

  if (payload.length() > 255) {
    Serial.println("Cannot send: packet exceeds 255 bytes");
    return;
  }

  Serial.println();

  if (isSOS) {
    Serial.println("Sending SOS packet");

    if (haveSavedLocation) {
      Serial.print("Coordinate: ");
      printSavedLocation();

      Serial.print("Coordinate age: ");
      Serial.print(locationAgeSeconds);

      Serial.println(" seconds");
    } else {
      Serial.println("SOS has no saved location");
    }
  } else {
    Serial.println("Sending position packet");

    Serial.print("Coordinate number: ");
    Serial.println(coordinateNumber);
  }

  Serial.print("Packet: ");
  Serial.println(payload);

  // Transmit through LoRa
  int16_t state = radio.transmit(payload);

  Serial.print("LoRa transmit result: ");
  Serial.println(state);

  if (state == RADIOLIB_ERR_NONE) {
    Serial.println("LoRa transmission completed");
  } else {
    Serial.println("LoRa transmission failed");
  }

  Serial.println();
}


// --------------------------------------------------
// CHECK SOS BUTTON WITH DEBOUNCING
// --------------------------------------------------

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

    // Button pressed: GPIO6 connected to GND
    if (stableButtonState == LOW) {
      Serial.println();
      Serial.println("SOS BUTTON PRESSED");

      sendPacket("sos");

      // Reset position transmission timer
      lastPositionAt = millis();

      nextPositionDelay =
        POSITION_INTERVAL_MS + esp_random() % 1200;
    }
  }
}


// --------------------------------------------------
// SETUP
// --------------------------------------------------

void setup() {
  Serial.begin(115200);
  delay(1000);

  // SOS button
  pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);

  lastButtonReading = digitalRead(SOS_BUTTON_PIN);
  stableButtonState = lastButtonReading;
  buttonChangedAt = millis();

  // GPS UART
  gpsSerial.begin(
    GPS_BAUD,
    SERIAL_8N1,
    GPS_RX_PIN,
    -1
  );

  // Initialize SPI for LoRa
  SPI.begin(
    LORA_SCK,
    LORA_MISO,
    LORA_MOSI,
    LORA_CS
  );

  // Initialize LoRa radio
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

  // Unique ID for this boot session
  bootId = String(esp_random(), HEX);

  Serial.println();
  Serial.println("==================================");
  Serial.println("       ALTiLink SOS Sender");
  Serial.println("==================================");

  Serial.print("Group: ");
  Serial.println(GROUP_ID);

  Serial.print("Member: ");
  Serial.println(MEMBER_ID);

  Serial.print("Radio initialization: ");
  Serial.println(state);

  if (radioReady) {
    Serial.println("LoRa ready at 866 MHz");
  } else {
    Serial.println("LoRa initialization failed");
  }

  Serial.println("GPS RX: GPIO20");
  Serial.println("SOS button: GPIO6 to GND");

  Serial.println("GPS status interval: 15 seconds");

  if (USE_FAKE_GPS) {
    Serial.println("Fake GPS mode: ENABLED");
    useFakeGPS();
  } else {
    Serial.println("Fake GPS mode: DISABLED");
    Serial.println("Waiting for real GPS fix");
  }

  lastGpsMessageAt = millis();

  lastPositionAt = millis();

  nextPositionDelay =
    POSITION_INTERVAL_MS + esp_random() % 1200;

  Serial.println("==================================");
  Serial.println();
}


// --------------------------------------------------
// MAIN LOOP
// --------------------------------------------------

void loop() {
  // Continuously process incoming GPS bytes
  readGPS();

  // Monitor SOS button
  checkButton();

  // Print status every 15 seconds
  reportGPSStatus();

  uint32_t now = millis();

  // Simulated coordinates remain usable for the demo.
  // Real GPS coordinates must be less than 10 seconds old
  // when fake GPS mode is disabled.
  bool locationIsRecent =
    haveSavedLocation
    && (
      USE_FAKE_GPS
      || now - savedLocationAt < 10000
    );

  // Automatically transmit position packets
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