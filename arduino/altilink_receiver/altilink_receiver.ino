#include <Arduino.h>

#include <SPI.h>

#include <RadioLib.h>

#include <BLEDevice.h>

#include <BLEServer.h>

#include <BLEUtils.h>

#include <BLE2902.h>

#include <ArduinoJson.h>

#include <TinyGPSPlus.h>

#include <Preferences.h>

#define GROUP_ID "ALT-TEST"
#define LORA_FREQUENCY_MHZ 866.0f
#define LORA_BANDWIDTH_KHZ 125.0f
#define LORA_SPREADING_FACTOR 7
#define LORA_CODING_RATE 5
#define LORA_SYNC_WORD 0x12
#define LORA_TX_DBM 10
#define LORA_CS 8
#define LORA_DIO1 14
#define LORA_RST 12
#define LORA_BUSY 13
#define LORA_SCK 9
#define LORA_MISO 11
#define LORA_MOSI 10
#define GPS_ENABLED false
#define GPS_RX_PIN 20
#define GPS_TX_PIN 5
#define GPS_BAUD 9600
#define GPS_MAX_AGE_MS 10000
#define POSITION_INTERVAL_MS 5000
#define SOS_BUTTON_PIN 6
#define BLE_SERVICE "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_WRITE "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_NOTIFY "6e400003-b5a3-f393-e0a9-e50e24dcca9e"

#define NODE_ID "M02"

const double DEMO_LAT = 2.7513888889;
const double DEMO_LON = 80.1963888889;

SX1262 radio = new Module(LORA_CS, LORA_DIO1, LORA_RST, LORA_BUSY);

TinyGPSPlus gps;

HardwareSerial gpsSerial(1);

Preferences settings;

BLECharacteristic* notifyCharacteristic;

BLEAdvertising* advertising;

QueueHandle_t commandQueue;

QueueHandle_t eventQueue;

struct CommandLine { char text[513]; };

struct EventLine { char text[1024]; };

volatile bool radioReceived = false;

volatile bool bleConnected = false;

volatile uint32_t bleSession = 0;

volatile bool restartAdvertising = false;

bool radioReady = false;

bool lastTxFix = false;

double lastTxLat = 0, lastTxLon = 0;

String groupId, nodeId, bootId;

uint32_t packetSequence = 0, positionSequence = 0;

uint32_t lastPosition = 0, lastLocal = 0, nextPositionDelay = POSITION_INTERVAL_MS;

uint32_t buttonSince = 0;

bool buttonSent = false;

EventLine activeEvent{};

size_t notifyOffset = 0, notifyLength = 0;

uint32_t lastNotify = 0;

String serialLine;

String duplicateIds[32];

uint8_t duplicateIndex = 0;

void IRAM_ATTR onRadio() { radioReceived = true; }

bool validId(const String& value) {

if (value.length() < 1 || value.length() > 20) return false;

for (size_t i = 0; i < value.length(); ++i) {

char c = value[i];

if (!isalnum(static_cast<unsigned char>(c)) && c != '-' && c != '_') return false;

}

return true;

}

bool validCoordinates(JsonVariantConst p) {

if (!p["lat"].is<double>() || !p["lon"].is<double>()) return false;

double lat = p["lat"], lon = p["lon"];

return isfinite(lat) && isfinite(lon) && abs(lat) <= 90 && abs(lon) <= 180;

}

bool hasFix() {
return true;
}

void appendFix(JsonDocument& doc) {
doc["fix"] = true;
doc["lat"] = serialized(String(DEMO_LAT, 6));
doc["lon"] = serialized(String(DEMO_LON, 6));
}

void emitEvent(JsonDocument& doc) {

if (measureJson(doc) > 1021) { Serial.println("Event too large"); return; }

EventLine line{};

size_t n = serializeJson(doc, line.text, sizeof(line.text) - 1);

line.text[n++] = '\n'; line.text[n] = '\0';

Serial.print(line.text);

if (bleConnected && xQueueSend(eventQueue, &line, 0) != pdTRUE) Serial.println("BLE event queue full: event dropped");

}

void result(const String& id, bool ok, const String& message, const String& pid = "") {

JsonDocument doc;

doc["v"] = 1; doc["event"] = "result"; doc["id"] = id; doc["ok"] = ok; doc["message"] = message;

if (pid.length()) {

doc["packetId"] = pid; doc["fix"] = lastTxFix;

if (lastTxFix) { doc["lat"] = serialized(String(lastTxLat, 6)); doc["lon"] = serialized(String(lastTxLon, 6)); }

}

emitEvent(doc);

}

void hello() {

JsonDocument doc;

doc["v"] = 1; doc["event"] = "hello"; doc["group"] = groupId; doc["node"] = nodeId;

doc["boot"] = bootId; doc["radio"] = radioReady;

emitEvent(doc);

}

void localPosition() {

JsonDocument doc;

doc["v"] = 1; doc["event"] = "local"; appendFix(doc); emitEvent(doc);

}

String idOf(JsonVariantConst p) {

return String(p["from"].as<const char*>()) + ":" + p["boot"].as<const char*>() + ":" + String(p["seq"].as<uint32_t>());

}

bool transmitPacket(const char* type, String& id, const String& ref = "", const String& to = "") {

if (!radioReady) return false;

JsonDocument p;

p["v"] = 1; p["type"] = type; p["group"] = groupId; p["from"] = nodeId;

p["boot"] = bootId; p["seq"] = ++packetSequence;

if (String(type) == "position") p["ps"] = ++positionSequence;

if (ref.length()) { p["ref"] = ref; p["to"] = to; }

if (String(type) == "ack") p["fix"] = false; else appendFix(p);

lastTxFix = p["fix"].as<bool>();

lastTxLat = DEMO_LAT; lastTxLon = DEMO_LON;

String payload;

serializeJson(p, payload);

if (payload.length() > 255) return false;

id = idOf(p.as<JsonVariantConst>());

radio.standby(); radioReceived = false;

int16_t state = radio.transmit(payload);

radioReceived = false;

int16_t rxState = radio.startReceive();

if (rxState != RADIOLIB_ERR_NONE) { radioReady = false; hello(); }

return state == RADIOLIB_ERR_NONE;

}

void handleCommand(const char* text) {

JsonDocument doc;

if (deserializeJson(doc, text)) { result("invalid", false, "Invalid JSON command"); return; }

String id = doc["id"] | "invalid";

if (!validId(id) || doc["v"].as<int>() != 1) { result("invalid", false, "Invalid command ID or protocol version"); return; }

String command = doc["command"] | "";

if (command == "status") { hello(); localPosition(); result(id, true, "Band status received"); }

else if (command == "configure") {

String group = doc["group"] | "", node = doc["node"] | "";

if (!validId(group) || !validId(node)) { result(id, false, "Invalid group or member ID"); return; }

group.toUpperCase(); node.toUpperCase();

groupId = group; nodeId = node;

settings.putString("group", groupId); settings.putString("node", nodeId);

for (String& old : duplicateIds) old = "";

hello(); result(id, true, "Group and member identity saved");

} else if (command == "sos" || command == "ack") {

if (!radioReady) { result(id, false, "LoRa unavailable: check radio configuration and Serial Monitor"); return; }

String ref = doc["ref"] | "", to = doc["to"] | "";

if (command == "ack" && (!validId(to) || ref.length() < 5 || ref.length() > 64)) { result(id, false, "Invalid acknowledgement target"); return; }

String pid;

bool ok = transmitPacket(command.c_str(), pid, ref, to);

result(id, ok, ok ? "LoRa transmission completed; peer delivery requires acknowledgement" : "LoRa transmission failed", ok ? pid : "");

} else result(id, false, "Unknown command");

}

void receivePacket() {

if (!radioReady || !radioReceived) return;

radioReceived = false;

String text;

int16_t state = radio.readData(text);

float rssi = radio.getRSSI(), snr = radio.getSNR();

int16_t rxState = radio.startReceive();

if (rxState != RADIOLIB_ERR_NONE) { radioReady = false; hello(); }

if (state != RADIOLIB_ERR_NONE || text.length() > 255) return;

JsonDocument p;

if (deserializeJson(p, text)) return;

String type = p["type"] | "", group = p["group"] | "", from = p["from"] | "", boot = p["boot"] | "";

if (p["v"].as<int>() != 1 || group != groupId || from == nodeId || !validId(from) || !validId(boot)) return;

if (type != "position" && type != "sos" && type != "ack") return;

if (!p["seq"].is<uint32_t>() || !p["fix"].is<bool>()) return;

if (type == "position" && !p["ps"].is<uint32_t>()) return;

if (p["fix"].as<bool>() && !validCoordinates(p.as<JsonVariantConst>())) return;

if (type == "ack" && (!validId(p["to"] | "") || !p["ref"].is<const char*>())) return;

String pid = idOf(p.as<JsonVariantConst>());

for (const String& old : duplicateIds) if (old == pid) return;

duplicateIds[duplicateIndex++ % 32] = pid;

JsonDocument event;

event["v"] = 1; event["event"] = "rx"; event["packet"] = p;

event["rssi"] = rssi; event["snr"] = snr;

emitEvent(event);

}

class ServerCallbacks : public BLEServerCallbacks {

void onConnect(BLEServer* server) override { ++bleSession; bleConnected = true; }

void onDisconnect(BLEServer* server) override { bleConnected = false; restartAdvertising = true; }

};

class WriteCallbacks : public BLECharacteristicCallbacks {

String buffer;

bool discarding = false;

uint32_t lastWrite = 0;

uint32_t session = 0;

void onWrite(BLECharacteristic* characteristic) override {

auto value = characteristic->getValue();

if (session != bleSession || millis() - lastWrite > 3000) { buffer = ""; discarding = false; }

session = bleSession; lastWrite = millis();

for (size_t i = 0; i < value.length(); ++i) {

char c = value[i];

if (c == '\n') {

if (!discarding && buffer.length()) {

CommandLine line{}; buffer.toCharArray(line.text, sizeof(line.text));

xQueueSend(commandQueue, &line, 0);

}

buffer = ""; discarding = false;

} else if (!discarding) {

buffer += c;

if (buffer.length() > 512) { buffer = ""; discarding = true; }

}

}

}

};

void flushBluetooth() {

if (restartAdvertising) {

restartAdvertising = false; xQueueReset(eventQueue); xQueueReset(commandQueue);

notifyOffset = notifyLength = 0; advertising->start();

}

if (!bleConnected) { notifyOffset = notifyLength = 0; return; }

if (notifyOffset >= notifyLength) {

if (xQueueReceive(eventQueue, &activeEvent, 0) != pdTRUE) return;

notifyOffset = 0; notifyLength = strlen(activeEvent.text);

}

if (millis() - lastNotify < 15) return;

size_t count = min(static_cast<size_t>(20), notifyLength - notifyOffset);

notifyCharacteristic->setValue(reinterpret_cast<uint8_t*>(activeEvent.text + notifyOffset), count);

notifyCharacteristic->notify(); notifyOffset += count; lastNotify = millis();

}

void setup() {

Serial.begin(115200);

commandQueue = xQueueCreate(8, sizeof(CommandLine));

eventQueue = xQueueCreate(16, sizeof(EventLine));

if (!commandQueue || !eventQueue) { Serial.println("Queue allocation failed"); while (true) delay(1000); }

settings.begin("altilink", false);

groupId = settings.getString("group", GROUP_ID); nodeId = settings.getString("node", NODE_ID);

bootId = String(esp_random(), HEX);

pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);

if (GPS_ENABLED) gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);

if (LORA_FREQUENCY_MHZ > 0) {

int16_t state = radio.begin(LORA_FREQUENCY_MHZ, LORA_BANDWIDTH_KHZ, LORA_SPREADING_FACTOR, LORA_CODING_RATE, LORA_SYNC_WORD, LORA_TX_DBM, 8, 1.8, false);

Serial.printf("Radio begin: %d\n", state);

if (state == RADIOLIB_ERR_NONE) {

radio.setDio1Action(onRadio); radioReady = radio.startReceive() == RADIOLIB_ERR_NONE;

}

} else Serial.println("Set LORA_FREQUENCY_MHZ in config.h to your verified demo frequency before radio use");

BLEDevice::init(("AltiLink-" + nodeId).c_str());

BLEServer* server = BLEDevice::createServer(); server->setCallbacks(new ServerCallbacks());

BLEService* service = server->createService(BLE_SERVICE);

notifyCharacteristic = service->createCharacteristic(BLE_NOTIFY, BLECharacteristic::PROPERTY_NOTIFY);

notifyCharacteristic->addDescriptor(new BLE2902());

BLECharacteristic* writeCharacteristic = service->createCharacteristic(BLE_WRITE, BLECharacteristic::PROPERTY_WRITE);

writeCharacteristic->setCallbacks(new WriteCallbacks());

service->start(); advertising = BLEDevice::getAdvertising(); advertising->addServiceUUID(BLE_SERVICE);

advertising->setScanResponse(true); advertising->start();

nextPositionDelay = POSITION_INTERVAL_MS + esp_random() % 1200;

hello();

}

void loop() {

if (GPS_ENABLED) while (gpsSerial.available()) gps.encode(gpsSerial.read());

receivePacket();

CommandLine command;

if (xQueueReceive(commandQueue, &command, 0) == pdTRUE) handleCommand(command.text);

while (Serial.available()) {

char c = Serial.read();

if (c == '\n') { if (serialLine.length()) handleCommand(serialLine.c_str()); serialLine = ""; }

else if (c != '\r') { serialLine += c; if (serialLine.length() > 512) serialLine = ""; }

}

uint32_t now = millis();

if (now - lastLocal >= 3000) { lastLocal = now; if (bleConnected) localPosition(); }

if (radioReady && now - lastPosition >= nextPositionDelay) {

lastPosition = now; nextPositionDelay = POSITION_INTERVAL_MS + esp_random() % 1200;

String id; transmitPacket("position", id);

}

if (digitalRead(SOS_BUTTON_PIN) == LOW) {

if (!buttonSince) buttonSince = now;

if (!buttonSent && now - buttonSince >= 2000) {

buttonSent = true;

handleCommand("{\"v\":1,\"id\":\"button\",\"command\":\"sos\"}");

}

} else { buttonSince = 0; buttonSent = false; }

flushBluetooth();

delay(1);

}
