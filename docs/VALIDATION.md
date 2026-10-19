# Validation record — Review 2 integration

## Completed checks

- TypeScript checking and Vite production build passed (`npm run build`).
- `npm test`: 45 tests passed: 17 active Review 2 algorithm tests, 13 unchanged legacy nested-project tests, 11 hardware protocol/client/range tests and 4 integrated application tests.
- Integration tests run the existing SimulationProvider, communicationService factory, BLE parser, command client and existing emergency/link pages with a fake BLE transport. They cover group provisioning, real-data projection, foreign-group filtering, duplicate SOS, no-fix handling, reverse ACKs, matching ACK correlation, immutable transmitted SOS coordinates, stale GPS, disconnect, mode persistence, disabled simulation in hardware mode, and suspended backend polling.
- Existing checkpoint generation/deletion/backtracking were exercised. A missing ML response correctly produces no prediction and no SOS.
- `npm run android:sync`: passed; native BLE plugin detected and current web assets copied. This does not compile an APK.
- Review 2 `server/`, `ml-model/`, existing algorithm utilities and the nested legacy project match the selected Review 2 source snapshot byte for byte. The uploaded project's extracted original has not been edited.

## Firmware status

The final firmware rebuild did not complete: the execution environment restarted during toolchain installation. The earlier bridge revision compiled successfully, but the current revision must still be compiled locally using the pinned PlatformIO command in START_HERE.md. This revision additionally echoes the exact transmitted SOS GPS fix in its result so a later position cannot rewrite an SOS location. No compiled firmware binary is supplied, and no board upload was performed.

## Not validated here

- No physical Heltec, GPS, BLE adapter or radio link was available to this runtime. Software tests do not prove hardware operation or measured range.
- No Android APK compilation/signing or installation: the Android SDK 36/JDK 21 toolchain is not available here.
- No iOS shell, background reception or screen-off SOS tests.
- DOM integration tests passed; a visual browser run was unavailable because the earlier Chromium download was incomplete.
- The existing trained model files were preserved, not retrained or re-evaluated. No new accuracy figure is claimed.

## Physical acceptance checklist

| Test | Expected result |
|---|---|
| Simple LoRa TX/RX | Exact text received, with both boards' radio settings recorded |
| Synthetic GPS | Exact test coordinates received and explicitly labelled synthetic |
| Independent NEO-6M UART | Valid NMEA and a real GPS fix outdoors |
| BLE connect | Actual group/node identity and radio readiness reported |
| Identity mismatch | App refuses to treat the band's packets as its own group until configured |
| Two compatible bands | Received peer ID and measured RSSI/SNR appear |
| No-fix packet | No invented coordinate, marker or distance |
| GPS on remote board only | Remote marker visible; relative distance/limit unavailable |
| Actual GPS on both boards | Coordinates correspond to the boards; separation updates |
| Different group | No foreign peer or SOS added |
| UI-originated SOS | Local transmission result; no recipient-delivery claim before ACK |
| Physical-button SOS | Remote app shows received SOS; GPS only if transmitted with a fix |
| ACK | Only matching packet reference and destination acknowledge the sender's SOS |
| No ACK | Delivery stays unconfirmed; no fabricated timeout success |
| Clear alert | Only this device hides the selected alert |
| Disconnect during command | Outcome unknown, live GPS invalid, new sends blocked |
| Peer powered off | Stale after 45 seconds; suggested limit withdrawn |
| Reconnect/reload | Fresh handshake required; no invented replay or switch to simulated GPS |
| Stable outdoor separation | Ten qualifying observations permit a conservative suggested limit |
| Moving/lossy link | Limit withheld when criteria fail |
| Phone/Android app | Repeat permissions, discovery, writes, notifications, SOS/ACK and disconnect tests |

Record actual results with board revision, radio frequency/settings, GPS module, antenna, environment, timestamps and distances. This prototype does not provide an emergency-delivery guarantee.
