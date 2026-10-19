#pragma once

#define NODE_ID "M02"
#define GROUP_ID "ALT-NXZD"

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

#define GPS_ENABLED true
#define GPS_RX_PIN 4
#define GPS_TX_PIN 5
#define GPS_BAUD 9600
#define GPS_MAX_AGE_MS 10000
#define POSITION_INTERVAL_MS 5000

#define SOS_BUTTON_PIN 6

#define BLE_SERVICE "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_WRITE "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_NOTIFY "6e400003-b5a3-f393-e0a9-e50e24dcca9e"