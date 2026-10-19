# ALTiLink — Review 2 Bluetooth integration copy

Work in **altilink-bluetooth-review2**, the top-level folder in this ZIP. Your uploaded source and extracted original were left untouched. The older nested `altilink combined(ML+App)` project is retained unchanged; do not run or edit that nested copy.

## Recommendation and current stage

**Keep developing the existing web application first, validate the staged two-board hardware tests, then package the same React application with Capacitor.** No React Native/Flutter rewrite is needed. The BLE transport already supports the native Capacitor plugin, and an optional Android shell is included for later testing. You do not need to build an APK for the current LoRa prototype demonstration.

Your latest master prompt takes priority. First demonstrate simple Heltec-to-Heltec messages, then synthetic GPS, then real NEO-6M GPS, then the BLE bridge. The code in this copy prepares that bridge; it does not establish that your physical boards/GPS/mobile app have passed those tests.

## Correct source version

The uploaded repository was checked out on `main` (`38a341a`), but its bundled Git history also contained `origin/review-2-implementation`. This copy uses that branch's available tip, **2aaeb150721e232ac5b4ead708475da21fbb45e9**, which includes the master prompt's **111abd8** Review 2 commit plus its subsequent ML update. It is a source snapshot, without `.git` history.

The Review 2 Python server, Random Forest model, feature extraction, training files, trail catalogue and existing algorithm utilities are unchanged. The original frontend's fabricated fall prediction on backend failure was removed: an unavailable model now produces an explicit unavailable state, without a fall/SOS. Initial prediction indicators no longer claim a model result before inference.

## What is implemented in this copy

- BLE discovery, connection, status handshake and group/member provisioning.
- Matching Heltec V3 firmware for GPS position packets, SOS and peer acknowledgements over raw LoRa.
- Hardware events flow through **communicationService → SimulationContext → existing pages**. There is no separate hardware application or second page-owned state store.
- Existing dashboard, hiking map, group GPS mini-map, emergency and link-status screens consume the selected data source.
- Coordinates are shown only when received with a valid, fresh fix; unknown positions are not replaced with trailhead coordinates. Real map markers are not artificially spread apart.
- Group filtering, duplicate suppression, GPS expiry, disconnect handling and command result correlation.
- Measured RSSI/SNR, sequence-gap delivery estimate and a conservative experimental separation limit.
- Bidirectional manual SOS/ACK, including the board's long-press SOS button. Sending locally is different from receiving a peer acknowledgement.
- Existing software demo remains available with checkpoint simulation, deletion, backtracking and Python model inference.

**Still planned:** hardware-driven checkpoint recording/backtracking, physical IMU integration, battery telemetry, buzzers/vibration, authenticated radio traffic, multi-hop routing, persistent SOS replay, background reception and downloaded offline map tiles. Map tiles currently need internet. Do not describe these as already integrated.

## 1. Run the copied website on your Mac

Install/use Node.js 22 or later. Extract the ZIP on your Desktop, then run:

```bash
cd ~/Desktop/altilink-bluetooth-review2
npm ci
npm run dev
```

Open the address printed by Vite (normally `http://localhost:5173`) in **Google Chrome**. Web Bluetooth requires a supported browser and HTTPS or localhost. Safari is not the browser target for this prototype.

For software fall-model tests, open another terminal in this same top-level folder:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r ml-model/requirements.txt
python server/server.py --port 3001
```

This is the existing lightweight Python HTTP server, not Flask/FastAPI. It uses temporary in-memory state. The Random Forest executes there, not in the browser. BLE GPS and manual hardware SOS do not need the Python server. The existing frontend's local group fallback is preserved; it does not guarantee backend-validated group membership.

## 2. Complete your staged radio and GPS tests

Keep your current Arduino sketches and known-working radio settings. The uploaded project did not contain the working TX/RX sketch, so the included bridge is a new, documented firmware contract, not an edit to that unseen sketch.

| Stage | Demonstrate before moving on |
|---|---|
| 1. Simple LoRa | Board A sends `Hello from ALTiLINK`; board B prints the exact text. Record the matching radio settings. |
| 2. Synthetic location | Send clearly labelled test coordinates and a member ID; verify the exact values on B. These are test data, not a satellite fix. |
| 3. Real GPS | Read the NEO-6M's NMEA output independently, obtain a fix, then send its real coordinates over LoRa. |
| 4. Application bridge | Use compatible bridge firmware on both boards and connect a browser to its local board over BLE. |

You can continue using the official Heltec ESP32 library selected in your master prompt for stages 1–3. The included bridge instead pins **RadioLib 7.1.2**, a direct SX1262 driver, plus ArduinoJson and TinyGPSPlus. This is an explicit implementation choice for the new bridge, not a replacement for your working official-library sketches. To retain your current firmware, adapt its received packets to `docs/PROTOCOL.md` after sharing that sketch; plain text/CSV packets are not automatically compatible with this JSON bridge.

## 3. Prepare the bridge firmware when ready

Target: **Heltec WiFi LoRa 32 V3 / ESP32-S3 / SX1262**, confirmed 863–928 MHz hardware variant.

1. Keep a backup of your working firmware.
2. Open `firmware/AltiLinkBridge/AltiLinkBridge.ino` and its `config.h`.
3. Replace `LORA_FREQUENCY_MHZ 0.0f` with the verified permitted frequency from your working test, compatible with the board and antenna. Zero intentionally disables LoRa; the UI will report radio unavailable until configured. Match bandwidth, spreading factor, coding rate and sync word on both boards.
4. Set different initial IDs (`M01` and `M02`) and the same initial group (`ALT-TEST`). The app will subsequently save the actual app group/member IDs to the connected board. Saved IDs override compile-time defaults after a reflash.
5. Build/upload using the pinned PlatformIO environment from the project root:

```bash
python3 -m venv .firmware-tools
source .firmware-tools/bin/activate
python -m pip install platformio
PLATFORMIO_SETTING_ENABLE_TELEMETRY=no pio run -d firmware
PLATFORMIO_SETTING_ENABLE_TELEMETRY=no pio run -d firmware -t upload
```

Connect one board at a time for upload, or specify its port with `--upload-port`. The pinned environment uses Espressif32 6.10.0 / Arduino-ESP32 2.0.17. If using Arduino IDE instead, select the matching V3 board/core and install RadioLib 7.1.2, ArduinoJson 7.3.1 and TinyGPSPlus 1.1.0. Arbitrary newer core versions have not been validated.

Attach the correct antennas before transmitting. Serial Monitor runs at **115200 baud**. `radio:true` confirms local initialization, not remote reception. The bridge uses no OLED. During normal operation, hold PRG (GPIO 0) for two seconds to send SOS; release before boot/reset.

### GPS wiring for this bridge

Heltec's V3 pin guidance identifies GPIO 4 and 5 as available external GPIOs and supports UART assignment through the ESP32-S3 IO matrix. This firmware configures them as follows; they are configurable choices, not fixed GPS-labelled pins.

| NEO-6M breakout | Heltec V3 |
|---|---|
| TX | GPIO 4, configured as GPS RX |
| RX | GPIO 5, configured as GPS TX; optional for receiving NMEA only |
| GND | GND |
| VCC | Supply allowed by your exact breakout board's specification |

Power off before rewiring. Do not infer breakout VCC from the NEO-6M chip name alone; UART signals must be ESP32-compatible 3.3 V logic. The sketch expects NMEA at 9600 baud. Obtain a fix outdoors and verify Serial output first.

One GPS on the remote board is enough to demonstrate remote coordinates on the website. **Both boards need fresh GPS to calculate their separation.** Phone GPS is not substituted. Set `GPS_ENABLED false` on a board without GPS; it can still exchange no-fix packets and SOS.

## 4. Connect the existing app to your boards

1. In the website, create a group as M01. Note its group code.
2. In the lobby, choose **Data source → My Heltec band**.
3. Click **Connect band** and select your local board. Allow browser/OS Bluetooth permission when prompted.
4. Click **Use this group and member ID**. Wait for a matching identity and “LoRa ready”.
5. Configure the other board for the same group with a different ID. Either join the group as M02 on a second browser/device and repeat steps 2–4, or use Serial Monitor with newline enabled:

```json
{"v":1,"id":"setup2","command":"configure","group":"REPLACE_WITH_APP_GROUP","node":"M02"}
```

6. Click **Open band session** to view the existing dashboard/map. This opens a local hardware session on each device; it does not synchronize hike start/end over LoRa. Hardware peers appear only after their packets are received. The lobby's Add Member control remains a software-demo feature.
7. Wait for positions. Missing/stale fixes show unavailable; received coordinates and measured radio data appear on the existing screens. The main map remains focused on your selected trail; use its fit/center controls when testing away from that trail. The mini-map shows relative received locations.
8. On M02, long-press PRG or send a manual SOS from its connected app. M01 receives an SOS alert. On its Emergency page, click **Acknowledge received SOS**.
9. M02's Serial Monitor or app should receive an ACK referencing that exact SOS. Test the reverse direction from M01's app too.

For a serial acknowledgement, use the exact received packet ID (`from:boot:seq`) and sender ID, for example:

```json
{"v":1,"id":"ack1","command":"ack","to":"M01","ref":"M01:REPLACE_BOOT:REPLACE_SEQ"}
```

There is no automatic retry. A completed local transmission leaves peer delivery **unconfirmed** until a matching ACK arrives. Clear on this device only hides the selected alert locally; it neither announces rescue nor resolves an alert on other boards. ACK transmission confirms the local send; it does not guarantee the sender received the ACK.

Keep each app in the foreground and connect only one browser/phone per board. Disconnect before changing devices. A peer becomes stale after 45 seconds. Disconnect removes live-position validity; visible alerts are retained until cleared or a new connection session begins. Reconnect starts fresh measurements and alert history. Missed SOS events are not stored/replayed by this firmware. Refreshing the page retains hardware mode but requires reconnecting, so it cannot silently fall back to simulated GPS.

Group IDs filter packets but do not authenticate them. This prototype has no BLE bonding policy or application-layer radio encryption, no mesh forwarding, and no background emergency service. Half-duplex radio and bounded BLE queues can lose packets. Use the acceptance tests before claiming field reliability.

## 5. Dynamic separation experiment

Use two GPS-equipped boards outdoors at a roughly constant separation for at least ten position transmissions (about a minute). The Communication screen uses the last two minutes of observations and requires:

- Ten or more fresh position packets, each with valid two-board GPS distance.
- Observed delivery ≥90%, average RSSI ≥−90 dBm and average SNR ≥0 dB.
- Separation spread ≤25 m or 10% of the maximum observed distance, whichever is greater.
- Recent local GPS and no peer silence beyond 45 seconds.

The minimum distance in a qualified window is the conservative tested separation. The selected margin lowers it to a suggested operating limit. A 100 m test with a 20% margin suggests regrouping within 80 m; it does not establish that the radio's maximum range is 80 m or 100 m. This policy uses the project's experimental thresholds, not a calibrated propagation model.

Delivery counts gaps between the first and last position sequence numbers received. It cannot count losses before/after that window and includes the BLE receive path. No estimate is created from terrain presets. The group limit requires qualified windows for every observed peer; an unheard member cannot be assessed because there is no enrolled hardware roster yet. Repeat measurements across distances and terrain before drawing range conclusions.

## 6. Optional later Android packaging

After the web/board exchange is validated, use the included Capacitor Android shell. The React screens, shared state and protocol remain the same; the native BLE plugin replaces Web Bluetooth.

With Node 22+, Android Studio, JDK 21 and Android SDK 36:

```bash
npm run android:sync
npm run android:open
```

Use Android Studio to sync Gradle and run on a physical Android phone with USB debugging. Grant Bluetooth/nearby-device and any requested location permissions. Repeat the physical tests. Rerun `android:sync` after React changes. **No APK is supplied or validated here.** An iOS project is not included.

Hardware GPS/SOS is local to BLE/LoRa and does not require the Python server. Software group synchronization and ML need the existing backend. On a phone, `localhost:3001` means the phone, not your Mac; set `VITE_BACKEND_URL` to a reachable backend before building those features. Trusted HTTPS is needed for HTTPS clients; native cleartext/network policies must also be addressed if using an HTTP development server. Do not interpret a backend connection failure as a model prediction.

Android Chrome can be used before packaging, but opening `http://MAC-LAN-IP:5173` is not a Web Bluetooth secure context. Use trusted HTTPS or USB port forwarding (`adb reverse tcp:5173 tcp:5173`) and phone localhost. This is separate from the native app.

## Files and verification

- `src/context/SimulationContext.tsx`: single app state and mode routing.
- `src/services/communicationService.ts`: existing HTTP/browser services and BLE client factory.
- `src/hardware/`: transport, protocol, central hook, projection and measured link policy.
- `src/components/hardware/`: controls embedded in existing screens.
- `firmware/`: matching bridge source and build configuration.
- `docs/PROTOCOL.md`: new v1 wire contract.
- `docs/VALIDATION.md`: checks completed and physical acceptance checklist.
- `docs/MASTER_PROMPT.txt`: supplied project context.

Run `npm test` and `npm run build` from the top level. Read the validation record for the distinction between software checks and real hardware tests.

## Primary references

- [Chrome Web Bluetooth](https://developer.chrome.com/docs/capabilities/bluetooth)
- [Capacitor BLE plugin](https://github.com/capacitor-community/bluetooth-le)
- [Capacitor Android](https://capacitorjs.com/docs/android)
- [Heltec V3 pin guidance](https://github.com/HelTecAutomation/HeltecWiKi/blob/main/docs/devices/open-source-hardware/esp32-series/lora-32/wifi-lora-32-v3/Pin-diagram-guidance.md)
- [Heltec LoRa 32 documentation](https://docs.heltec.org/en/node/esp32/wifi_lora_32/index.html)
- [RadioLib](https://github.com/jgromes/RadioLib)
