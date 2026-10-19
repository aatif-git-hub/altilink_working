# AltiLink bridge protocol v1

## Transport

BLE peripheral: Heltec. BLE central: browser or native app. Service and characteristics use the Nordic UART UUID layout, carrying this project's own JSON protocol (not a generic serial profile).

| Endpoint | UUID | Operation |
|---|---|---|
| Service | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` | Discovery |
| App → band | `6e400002-b5a3-f393-e0a9-e50e24dcca9e` | Write with response |
| Band → app | `6e400003-b5a3-f393-e0a9-e50e24dcca9e` | Notify |

UTF-8 JSON lines, newline terminated. Both directions split into 20-byte chunks to work with the default ATT payload. A notification is not necessarily an entire JSON object. App commands are serialized to prevent interleaving; notification frames are buffered and parsed with a bounded decoder. Maximum app command is 512 bytes including newline; maximum event frame is 1024 bytes. Malformed/oversize input is rejected, and framing recovers at a newline. Firmware processes commands on its main loop, not in the BLE callback. In-memory queues are bounded; overflow can drop messages and is not lossless storage.

## Commands

```json
{"v":1,"id":"c1","command":"status"}
{"v":1,"id":"c2","command":"configure","group":"ALT-TEST","node":"M01"}
{"v":1,"id":"c3","command":"sos"}
{"v":1,"id":"c4","command":"ack","to":"M02","ref":"M02:ab1234:27"}
```

IDs use 1–20 alphanumeric/underscore/hyphen characters. Each result correlates by command `id`. Unknown commands return `ok:false`. No command is automatically retried after a timeout: an unknown outcome must not be represented as confirmed failure or confirmed delivery.

## Events

```json
{"v":1,"event":"hello","group":"ALT-TEST","node":"M01","boot":"a123","radio":true}
{"v":1,"event":"local","fix":true,"lat":13.0827,"lon":80.2707}
{"v":1,"event":"local","fix":false}
{"v":1,"event":"result","id":"c3","ok":true,"message":"LoRa transmission completed; peer delivery requires acknowledgement","packetId":"M01:a123:12","fix":true,"lat":13.0827,"lon":80.2707}
{"v":1,"event":"rx","packet":{"v":1,"type":"position","group":"ALT-TEST","from":"M02","boot":"ab1234","seq":25,"ps":20,"fix":true,"lat":13.0837,"lon":80.2707},"rssi":-78,"snr":5.5}
```

Successful transmission results echo the exact transmitted `fix` and optional coordinates. The UI retains that SOS location even if subsequent live GPS changes. An older result without these fields displays no SOS location rather than borrowing a later fix.

`status` produces hello, local GPS and result in that order. Group configuration is acknowledged with a fresh hello; it clears the app's old group session. `radio:true` only indicates successful local radio setup. `local` GPS is sent every three seconds while connected; fixes older than ten seconds are invalidated by firmware. The app also treats unreplenished data as stale.

## LoRa wire packet

Raw point-to-point LoRa, not LoRaWAN or Meshtastic. Each radio transmission is one JSON object, at most 255 bytes. Both boards must run compatible firmware and exactly matching radio settings.

Common fields: `v`, `type`, `group`, `from`, `boot`, `seq`, `fix`. If `fix:true`, include finite `lat` and `lon` in WGS84 decimal degrees. `fix:false` carries no usable position. Position messages also include `ps`, an independent position-only sequence counter. SOS/ACK do not consume `ps`, avoiding false position-loss estimates when emergency traffic is interleaved.

`type` is `position`, `sos` or `ack`. Packet identity is `from:boot:seq`. `seq` increases for every attempted radio transmission; the random boot ID changes after restart. The sequence fields are 32-bit unsigned counters. Before eventual wraparound, restart the board to establish a new boot ID.

SOS may include GPS or explicitly have no fix. ACK uses `ref` for the SOS packet identity and `to` for its sender, with `fix:false` to keep the radio packet compact. It means the peer operator acknowledged that exact packet, not that rescue is complete. The app does not infer acknowledgement from BLE write completion or from local transmission success.

The firmware filters foreign groups and self-origin packets, and suppresses 32 recently seen packet IDs. The app repeats group checks and retains up to 1024 IDs. These are basic duplicate filters, not cryptographic replay protection. No forwarding/hop implementation is present. Current IDs and coordinates are transmitted without application-layer encryption.

## Existing firmware integration

If you keep your current radio sketch, add the same BLE service, framing, command handlers and event envelopes. Translate your existing received payload into the documented `rx` event, preserving the actual radio RSSI/SNR. For reliable position-loss estimates, the transmitting board must provide boot and position sequence counters. Strings such as `Hello 1` or comma-separated coordinates are not automatically compatible. Do not label arbitrary data as GPS or produce ACKs without a real peer response.

## Device independence

Both boards run the same bridge firmware and can transmit and receive. A phone is not required for periodic GPS packets or the physical SOS button. BLE is only the local UI connection. Group identity persists in board Preferences; sample histories and SOS/ACK UI records are session-only.

## App integration

`communicationService.createBandClient` owns the transport construction. `SimulationContext` runs one `useBand` instance and projects it into the existing Member, EmergencyPacket and LinkAssessmentResult values. Existing pages use `useSimulation()`. Hardware mode suspends software backend polling and BroadcastChannel subscriptions; simulated coordinates, terrain measurements, checkpoints and timed ACKs cannot become hardware measurements. Configuration must match the current app group/member before hardware data is exposed.
