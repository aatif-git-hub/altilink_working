# AltiLink — Fall Detection Machine Learning Subsystem

> **Project:** AltiLink – A Solar-Powered, LoRa-Based Group-Awareness Safety Network for Hikers and Mountain Expeditions  
> **Subsystem:** Machine Learning Fall & Incapacitation Detection Pipeline (TRL 4–5 Academic Integration)  
> **Status:** Software & Signal Processing Validation Stage  

---

## 1. Project Overview & Scope

AltiLink is an outdoor safety ecosystem designed for hikers and search-and-rescue teams operating in remote alpine environments without cellular infrastructure. The comprehensive system architecture includes:
- An ESP32 wearable wrist/waist band with an onboard 6-axis IMU (accelerometer + gyroscope).
- A Bluetooth Low Energy (BLE) bridge streaming continuous IMU telemetry to an Android smartphone.
- An edge-native Digital Signal Processing (DSP) and Random Forest classifier running on the phone.
- A two-stage "rouse-and-confirm" safety protocol (haptic vibration and audio alarm).
- An emergency LoRa packet broadcast (`[Member_ID, Event_Type, GPS_Lat, GPS_Lon, Timestamp, Hop_Count]`) traversing ad-hoc repeater nodes to alert group members.

### Honest Scope & Academic Integrity Statement
> **IMPORTANT:** At this stage of development, data collection from our custom AltiLink wearable hardware has **not** yet commenced. Therefore, the fall-detection pipeline in this repository is trained and validated using a recognized, publicly available benchmark dataset (**SisFall**). This validates our end-to-end signal processing, sliding-window feature extraction, subject-independent generalization, and lightweight machine learning classification approach.
>
> **These results measure performance on the SisFall benchmark under a strict subject-wise hold-out protocol. They should NOT be interpreted as the final real-world accuracy of the physical AltiLink wearable band.** Once real AltiLink wearable IMU data is collected, the identical feature-extraction and training pipeline will be retrained and validated on native device data.

---

## 2. Dataset Selection: SisFall Benchmark

* **Official Paper:** Sucerquia, A.; López, J.D.; Vargas-Bonilla, J.F. *SisFall: A Fall and Movement Dataset.* Sensors 2017, 17(1), 198. [DOI: 10.3390/s17010198](https://doi.org/10.3390/s17010198)
* **Hosting / Source URL:** [https://huggingface.co/datasets/abys7315/Sisfall_Dataset](https://huggingface.co/datasets/abys7315/Sisfall_Dataset) and Mendeley Data.
* **Why SisFall was Chosen:**
  1. **Sensor Alignment:** Provides synchronized triaxial accelerometer ($\pm 16\text{g}$) and triaxial gyroscope ($\pm 2000^\circ/\text{s}$) sampled at $200\text{ Hz}$.
  2. **Demographic Diversity:** Contains recordings from 38 subjects (23 young adults `SA01`–`SA23`, 15 elderly adults `SE01`–`SE15`).
  3. **Rich Activity Taxonomy:** Includes 19 distinct Activities of Daily Living (ADLs: walking, jogging, stairs, stumbling without falling, sitting) and 15 simulated Fall types (forward, backward, lateral, syncope).
  4. **Fixed Placement:** Body-worn waist placement reflects upper-body kinematic inertia similar to field expedition dynamics.
* **Dataset Limitations:**
  - Fall events were simulated onto crash mats in controlled laboratory settings by participants, which may produce higher acceleration transients than uncontrolled soft-ground outdoor falls.
  - Device orientation is fixed to the waist, whereas eventual AltiLink wearable hardware may be worn on the wrist or backpack harness.

---

## 3. Signal Processing & Feature Extraction Pipeline

Continuous IMU streams are converted from raw ADC integer counts to physical units ($g$, $\text{m/s}^2$, $\text{deg/s}$, $\text{rad/s}$) using calibrated hardware scale factors.

```
Raw IMU Telemetry (200 Hz: Ax, Ay, Az, Gx, Gy, Gz)
   │
   ▼
[Physical Unit Conversion & Signal Magnitude Calculation]
   │
   ▼
[Non-Overlapping Trial Sliding Windowing (2.56s = 512 samples, 50% overlap)]
   │
   ├───────────────────────────────┬───────────────────────────────┐
   ▼                               ▼                               ▼
[Time-Domain Magnitude]       [Axis-Level Statistics]     [Frequency-Domain FFT]
• Mean, Std, Var, Min, Max    • Mean, Std, Var, Min, Max  • Dominant Frequency
• Peak-to-Peak Range          • For Ax, Ay, Az, Gx, Gy, Gz • Spectral Energy
• RMS, Zero-Crossing Rate                                 • Low-Band Power (0.5-3.0 Hz)
• Signal Magnitude Area (SMA)                             • High-Band Power (3.0-10.0 Hz)
   │                               │                               │
   └───────────────────────────────┴───────────────────────────────┘
                                   │
                                   ▼
                   [Engineered Feature Vector (Row)]
```

### Engineered Features per Window:
1. **Acceleration & Angular Velocity Magnitudes:**
   $$A_{\text{mag}}[n] = \sqrt{a_x[n]^2 + a_y[n]^2 + a_z[n]^2}, \quad \Omega_{\text{mag}}[n] = \sqrt{\omega_x[n]^2 + \omega_y[n]^2 + \omega_z[n]^2}$$
2. **Signal Magnitude Area (SMA):**
   $$\text{SMA} = \frac{1}{N} \sum_{n=1}^N \left(|a_x[n]| + |a_y[n]| + |a_z[n]|\right)$$
3. **FFT Spectral Energy & Frequency Bands:**
   - Detrended one-sided FFT spectrum via `scipy.fft` / `numpy.fft.rfft`.
   - **Dominant Frequency:** Peak frequency bin (excluding the DC $0\text{ Hz}$ component).
   - **Low-Frequency Band ($0.5 - 3.0\text{ Hz}$):** Captures rhythmic gait and normal human movement cadence.
   - **High-Frequency Impact Band ($3.0 - 10.0\text{ Hz}$):** Captures high-jerk shock impacts and rapid transitions during falls.

---

## 4. Subject-Wise Train/Test Hold-Out Methodology

> **Critical Anti-Gaming Rule:** Overlapping sliding windows from the same subject trial share heavy autocorrelation. If windows from the same person appear in both training and test sets, the model partially memorizes individual movement signatures, yielding deceptively high accuracy.

* **Protocol:** We strictly partition subjects using `GroupShuffleSplit` on `subject_id`.
* **Validation Split:** 30 subjects (~80%) for training; 8 completely unseen subjects (~20%) for testing (stratified across young and elderly participants).
* **Leakage Verification:** Programmatic assertion confirms:
  $$\text{Train Subjects} \cap \text{Test Subjects} = \emptyset$$

---

## 5. Machine Learning Architecture: Random Forest

* **Model Choice:** `RandomForestClassifier` (200 estimators, balanced class weights).
* **Rationale for AltiLink:**
  1. **Explainability & Trust:** Ensemble decision trees allow feature importance ranking (`outputs/feature_importance.png`) to verify physiological impact dynamics.
  2. **Edge Deployability:** Low inference latency (<5 ms) and minimal memory footprint, ideal for background smartphone execution without draining expedition battery packs.
  3. **Robustness:** Handles class imbalance and non-linear interactions without requiring deep neural network accelerators.

---

## 6. Installation & Reproducibility Guide

### Step 1: Environment Setup
```bash
cd /Users/manichidambaram/.gemini/antigravity/scratch/altilink-fall-detection
pip install -r requirements.txt
```

### Step 2: Download & Audit SisFall Dataset
```bash
python data_loader.py --download
python data_loader.py --summary
```

### Step 3: Train Model & Evaluate on Held-Out Subjects
```bash
python train_model.py
```
This outputs:
- Terminal classification report (Accuracy, Precision, Recall, F1, Confusion Matrix)
- `outputs/metrics.json`
- `outputs/confusion_matrix.png`
- `outputs/feature_importance.png`
- Serialized model bundle: `models/fall_detector.joblib`
- Held-out live demo window bank: `demo_data/held_out_test_windows.joblib`

### Step 4: Run the Deterministic Live Classification Demo
```bash
python demo_live_classification.py
```
Demonstrates real-time window ingestion, feature extraction, and prediction on isolated, unseen test subject samples.

---

## 7. Project Structure

```
altilink-fall-detection/
├── README.md                    # System architecture and academic documentation
├── requirements.txt             # Core dependency definitions
├── data_loader.py               # Raw SisFall parsing, calibration, unit scaling, audit CLI
├── feature_extraction.py        # Sliding windowing, DSP time-domain & FFT band feature extraction
├── train_model.py               # Subject-wise holdout, RF training, metrics reporting, plot generation
├── demo_live_classification.py  # Live inference demo consuming held-out test windows
├── data/
│   ├── README.md                # Dataset source citations and specifications
│   └── sisfall/                 # Directory holding raw SisFall trials
├── models/
│   └── fall_detector.joblib     # Saved model artifact and pipeline metadata
├── outputs/
│   ├── metrics.json             # Numerical evaluation results
│   ├── confusion_matrix.png     # Heatmap visualization
│   └── feature_importance.png   # Ranked feature bar chart
└── demo_data/
    └── held_out_test_windows.joblib # Unseen test windows for live evaluation
```

---

## 8. Limitations and Future Hardware Integration

1. **Hardware Retraining:** Once the physical AltiLink ESP32 wearable band is fabricated and field testing commences in mountainous terrain, real hiker motion data will replace the laboratory benchmark data.
2. **Wrist Kinematics:** Future iterations will account for wrist-specific arm swing and trekking pole vibrations by retraining with mountain expedition trials.
3. **Multi-Sensor Fusion:** Future integration will fuse barometer pressure drop (altitude rate-of-change) with IMU shock vectors.
