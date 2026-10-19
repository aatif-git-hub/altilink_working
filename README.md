> **Bluetooth integration copy:** Start with [START_HERE.md](START_HERE.md) and [validation](docs/VALIDATION.md). The original Review 2 README below describes the software prototype. Its simulated/live-sensor and mesh wording must not be read as proof of physical hardware integration.

# ALTiLINK — Off-Grid Hiking Group Safety & Awareness System

## 1. System Overview & Architecture

AltiLink provides off-grid group hiking awareness, periodic checkpoint tracking, terrain-adaptive communication range estimation, manual SOS distress broadcasting, and machine-learning-based fall detection when cellular networks are unavailable.

```
┌─────────────────────────────────────────────────────────────┐
│                    ALTiLINK ARCHITECTURE                    │
└─────────────────────────────────────────────────────────────┘

  [ Client Browser Tab 1 ]          [ Client Browser Tab 2 ]
    (Nirmal - Leader M01)             (Rahul - Member M02)
             │                                 │
             ▼                                 ▼
  ┌─────────────────────────────────────────────────────────┐
  │   React + TypeScript Frontend (Port 5173 / Vite)       │
  │   - Topographic Trail Map & Checkpoints (CP1..CPN)      │
  │   - Checkpoint Deletion with Confirmation               │
  │   - Sequential Backtracking Engine                     │
  │   - Communication Check (Field RF Propagation Model)    │
  │   - Manual SOS & 10s Fall Confirmation UI               │
  └─────────────────────────────────────────────────────────┘
             │                                 │
             ▼                                 ▼
  ┌─────────────────────────────────────────────────────────┐
  │   Local Backend & ML Server (server/server.py: 3001)   │
  │   - REST API for Multi-Device Synchronization          │
  │   - Group State Registry (Lobby, Active, SOS, CPs)     │
  │   - Direct ML Inference Bridge (POST /api/ml/predict)  │
  └─────────────────────────────────────────────────────────┘
             │
             ▼
  ┌─────────────────────────────────────────────────────────┐
  │   Existing ML Subsystem (ml-model/)                     │
  │   - feature_extraction.py (53 DSP/FFT features @ 200Hz) │
  │   - models/fall_detector.joblib (200-Tree Random Forest)│
  │   - Evaluated on SisFall Benchmark Dataset              │
  └─────────────────────────────────────────────────────────┘
```

---

## 2. Real Hiking Trail Catalogue & Geography

All hiking routes in the trail catalogue use real geographical coordinates in the Western Ghats mountain wilderness (compatible with OpenTopoMap topographic contours, hillshading, and mountain terrain):

1. **Kudremukh Peak Trail (Chikkamagaluru, Western Ghats, Karnataka)**
   - Trailhead (Muleodi Forest Gate Checkpost): `13.1780° N, 75.2850° E` (820m altitude)
   - Route: Ascends through Somavathi stream crossing (`13.1672, 75.2815`), Ontimane Lobo house (`13.1550, 75.2770`), Shola grassland ridge (`13.1435, 75.2725`), and Zig-Zag climb to Kudremukh Peak summit (`13.1285, 75.2678`, 1,894m altitude).
   - Distance: 9.4 km | Elevation Gain: +1,074m.

2. **Western Ghats Ridge Trail (Pushpagiri / Kumara Parvatha Ridge, Karnataka)**
   - Base Trailhead (Kukke Checkpost): `12.6782° N, 75.6025° E` (350m altitude)
   - Route: Passes through meadow crossing (`12.6720, 75.6185`), rock shelter waypoint (`12.6685, 75.6320`), ridge lookout (`12.6640, 75.6480`), to Pushpagiri ridge summit (`12.6615, 75.6575`, 1,712m altitude).
   - Distance: 7.2 km | Elevation Gain: +640m.

3. **Brahmagiri Sanctuary Loop (Brahmagiri Wildlife Sanctuary, Coorg / Wayanad)**
   - Trailhead (Iruppu Forest Gate): `11.9680° N, 75.9890° E` (750m altitude)
   - Route: Crosses upper forest stream (`11.9595, 75.9960`), Munikal cave (`11.9480, 76.0075`), grassland ridge camp (`11.9390, 76.0160`), to Brahmagiri Peak summit (`11.9285, 76.0240`, 1,608m altitude).
   - Distance: 12.2 km | Elevation Gain: +858m.

4. **Custom Trek Mode:** Open expedition without predefined route polyline. Allows live GPS tracking, ad-hoc checkpoint recording, and backtracking.

---

## 3. Core Functional Modules

### 1. Leader-Controlled Group & Hike Setup
- **Clean Start:** Welcome screen with `[ CREATE GROUP ]` and `[ JOIN GROUP ]`.
- **Role Assignment:** Group creator is designated as **Group Leader** (`isLeader: true`).
- **Trek Selection:** Existing Trek (with `[ VIEW ROUTE ]` topographic map preview and `[ DOWNLOAD OFFLINE ]` cache) vs. Custom Trek.
- **Configurable Checkpoint Interval:** Configurable auto-recording frequency (3, 5, 10, 15 min, default 5 min).
- **Leader Permission Enforcement:** Only the leader can select the trek, adjust the interval, and start the hike.

### 2. Dynamic Periodic Checkpointing, Deletion & Simulation Controls
- **Elapsed Time Tracking:** Tracks hike duration (`00:00`, `00:05`, `00:10`...).
- **Simulation Controls:** `[ +1 Min ]` and `[ +5 Min ]` buttons to advance simulated time.
- **Dynamic Checkpoint Generation:** When elapsed time crosses the configured interval, a dynamic checkpoint (`CP1`, `CP2`, `CP3`... `CP_N`) is created along the trail route.
- **Checkpoint Deletion with Confirmation:** Every checkpoint in the list includes a `[ DELETE ]` action with confirmation. Deleting a checkpoint removes it from the list, map markers, multi-device backend state, and backtracking sequence.
- **Manual Waypoints:** `[ + Add Waypoint ]` allows recording ad-hoc landmarks.

### 3. Sequential Route Backtracking
- **Arbitrary History Reversal:** Dynamically traverses the actual recorded checkpoint list in reverse order ($\text{Current} \to \text{CP}_N \to \dots \to \text{CP}_1 \to \text{Start}$).
- **Exclusion of Deleted Checkpoints:** Deleting a checkpoint immediately updates the backtracking path.

### 4. Communication Check (Link Assessment)
- **Field Test Utility:** Select environment (*Open Terrain / Ridge*, *Dense Forest / Canopy*, *Mountainous / Gorge*) and click `[ TEST CONNECTION ]`.
- **Output:** Signal Strength, Signal Quality, Packet Delivery Rate (e.g. 94%), Estimated Communication Range (400m), and Recommended Operating Range (320m with 20% safety margin).

### 5. Emergency Subsystem (Two Distinct Paths)
- **Path A: Manual SOS**
  - `[ SIMULATE SOS ]` $\to$ Captures GPS fix $\to$ Builds SOS packet $\to$ Broadcasts over mesh $\to$ Peer ACKs $\to$ Physical wearable buzzer/vibration trigger.
- **Path B: ML Fall Detection & Confirmation Window**
  - `[ SIMULATE FALL ]` $\to$ Streams 200 Hz IMU sensor samples $\to$ Evaluates 53 DSP/FFT features $\to$ Python Random Forest classifier predicts `FALL` $\to$ Possible Fall Alert $\to$ **10-second confirmation countdown**.
  - `[ I'M OK — CANCEL ]`: Cancels alert ("False alarm — SOS cancelled").
  - Expiration: Fall confirmed $\to$ Automatic SOS packet broadcasted to all group members.

---

## 4. Machine Learning Subsystem (`ml-model/`)

The application integrates directly with the existing trained fall detection model:

- **Model Artifact:** `ml-model/models/fall_detector.joblib`
- **Classifier:** `sklearn.ensemble.RandomForestClassifier(n_estimators=200, max_depth=16, class_weight='balanced')`
- **Feature Pipeline:** 53 engineered features in `ml-model/feature_extraction.py` (acceleration magnitude, jerk, posture tilt angles, angular velocity magnitude, FFT spectral energy bands).
- **Evaluation Dataset:** SisFall Public Benchmark (200 Hz, subject-wise holdout validation).
- **Reported Accuracy:** ~89.3% accuracy, ~78.3% F1-score across unseen test cohorts.

---

## 5. How to Run the Project

### 1. Start Python Backend & ML Inference Server
```bash
python server/server.py --port 3001
```

### 2. Start React + Vite Development Frontend
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. Run Automated Tests
```bash
npm test
```

### 4. Build Production Bundle
```bash
npm run build
```
