# AltiLink — ML Subsystem Implementation Contract

> **Project:** AltiLink – A Solar-Powered, LoRa-Based Group-Awareness Safety Network for Hikers and Mountain Expeditions
> **Scope:** Fall-Detection ML Pipeline (Phase 1 of AltiLink ML subsystem)
> **Document type:** Implementation engineer briefing / planning contract

---

## 1. Project Context

AltiLink is a college hardware + software project. The eventual system contains:

- ESP32 + LoRa wearable band
- IMU / accelerometer
- SOS button
- Buzzer / haptic feedback
- BLE connection to Android phone
- Phone GPS
- Random Forest fall/incapacitation classifier
- Sensor-fusion / Kalman-filter stage
- LoRa repeater
- Android app with offline maps and group awareness
- SOS packet containing member ID, event type, GPS coordinates, timestamp, hop count

**The current ML task is ONLY to build and validate the fall-detection ML pipeline.**

The physical wearable sensor data does NOT exist yet.

---

## 2. Honesty Requirements (Non-Negotiable)

The following are strictly prohibited:

- ❌ Pretending hardware data has been collected
- ❌ Fabricating measurements
- ❌ Fabricating accuracy numbers
- ❌ Claiming the model has been validated on AltiLink hardware
- ❌ Creating fake sensor CSV files and presenting them as real
- ❌ Random row-level train/test splitting
- ❌ Artificially manipulating the test set to improve accuracy
- ❌ Reporting accuracy before the training script has actually run on a real public dataset

**Honest project statement:**

> "At this stage, the fall-detection approach is trained and validated using a publicly available IMU dataset because our custom hardware sensor data collection has not started yet. This validates the feature-extraction and classification approach. The same pipeline will be retrained and revalidated using real AltiLink wearable data once hardware data collection begins."

---

## 3. Phase 1 — Dataset Research

Before implementation, investigate the current public availability of:

1. **SisFall**
2. **MobiAct**

For each dataset determine:

- Is it publicly accessible right now?
- What is the official/original source?
- Is the download link working?
- What files/formats are provided?
- Does it contain accelerometer data?
- Does it contain gyroscope data?
- What is the sampling frequency?
- How are subjects identified?
- How are falls identified?
- What normal ADL/activity classes exist?
- Is it realistically possible to download and process it reproducibly?

**Selection rule:** Prefer the dataset that is actually accessible and easiest to load reliably. Do NOT choose a dataset just because it sounds good. If SisFall is accessible and practical, prefer it. If SisFall is unavailable/broken and MobiAct is accessible, use MobiAct.

The README must contain:
- Dataset name, citation/reference, exact source URL
- Date/accessibility note
- Why this dataset was selected
- Dataset limitations
- Exact download/setup instructions

---

## 4. Phase 2 — Proposed Project Structure

```
altilink-fall-detection/
│
├── data_loader.py
├── feature_extraction.py
├── train_model.py
├── demo_live_classification.py
├── requirements.txt
├── README.md
│
├── data/
│   └── README.md
│
├── models/
│   └── (trained model generated after training)
│
├── outputs/
│   ├── confusion_matrix.png
│   ├── feature_importance.png
│   └── metrics.json
│
└── demo_data/
    └── (held-out test windows or references needed by the demo)
```

Reliability and reproducibility are more important than fancy architecture.

---

## 5. Phase 3 — Data Loading (`data_loader.py`)

Must parse the selected public dataset into a clean representation containing, where available:

| Column | Description |
|---|---|
| `subject_id` | Person identifier |
| `timestamp` | Sample index or timestamp |
| `acc_x`, `acc_y`, `acc_z` | Accelerometer axes |
| `gyro_x`, `gyro_y`, `gyro_z` | Gyroscope axes |
| `label` | Binary: 1 = FALL, 0 = NORMAL/ADL |

Additional column for original activity name/category is acceptable.

Must handle the **actual raw dataset format** (not assumed generic CSV). Document all unit conversions explicitly.

CLI/test mode must print:
- Number of rows
- Number of subjects
- Class distribution
- Columns
- Sampling rate (if known)

---

## 6. Phase 4 — Signal Processing + Windowing (`feature_extraction.py`)

Default configuration:

| Parameter | Value |
|---|---|
| Window duration | ~2–3 seconds |
| Overlap | 50% |
| Sampling frequency | Determined from selected dataset |
| Window size | Configurable |

**Critical rule:** `window_samples = window_seconds × sampling_frequency` — never hard-code a sample count without accounting for actual sampling frequency.

Windowing must **never cross subject boundaries**. Each window retains subject_id, label, source/activity metadata, and window index information.

---

## 7. Phase 5 — Features

### A) Accelerometer Magnitude

`magnitude = sqrt(ax² + ay² + az²)`

Features: mean, std, variance, min, max/peak, range, RMS, zero-crossing rate, SMA (signal magnitude area)

### B) Axis-Level Features

For ax, ay, az: mean, std, variance, min, max

### C) FFT / Frequency-Domain Features

For each window:
- Detrend/preprocess before FFT where justified
- Dominant frequency (exclude DC component)
- Spectral energy
- Energy in at least two meaningful frequency bands (documented and justified)
- Use one-sided spectrum for real-valued signals

### D) Feature Matrix Output

One row per window. Columns include subject_id, label, and all extracted features. Must be **deterministic** and **identical** between training and demo.

---

## 8. Phase 6 — Subject-Wise Split (CRITICAL)

The train/test split **must** be performed by **SUBJECT/PERSON ID**.

**Never randomly split individual windows.**

**Reason:** Overlapping windows from the same person's recording are highly correlated. Random splits allow the model to partially memorize a person's patterns, producing optimistic accuracy.

Use `GroupShuffleSplit` or `StratifiedGroupKFold` from sklearn.

**Required checks:**

```python
assert set(train_subjects) & set(test_subjects) == set(), "SUBJECT OVERLAP DETECTED — STOPPING"
```

Print train and test subject IDs. If overlap is detected, stop with an error.

---

## 9. Phase 7 — Random Forest (`train_model.py`)

```python
from sklearn.ensemble import RandomForestClassifier
```

Suggested starting parameters:
- `n_estimators`: 100–300
- `random_state`: fixed for reproducibility
- `class_weight="balanced"` if dataset is imbalanced

Rules:
- Training data only for model fitting
- Held-out subjects only for final evaluation
- If validation needed for tuning, create a validation split from **training subjects only**
- Do **not** tune on test subjects

---

## 10. Phase 8 — Metrics

Evaluate **only** on held-out subjects. Positive class = FALL (label = 1).

Report:
- Accuracy
- Precision
- Recall
- F1-score
- Confusion matrix

Print summary:

```
==================================================
ALTILINK FALL DETECTION — TEST RESULTS
==================================================

Dataset: ...
Sampling rate: ...
Window: ... seconds
Overlap: ... %

Training subjects: ...
Held-out test subjects: ...

Accuracy : XX.XX%
Precision: XX.XX%
Recall   : XX.XX%
F1-score : XX.XX%

Confusion Matrix:
[[TN FP]
 [FN TP]]

==================================================
```

Save to `outputs/metrics.json`.

---

## 11. Phase 9 — Confusion Matrix

Save `outputs/confusion_matrix.png` using matplotlib.

Requirements:
- FALL / NORMAL labels
- Actual vs predicted axes
- Counts in cells
- Title containing model/dataset information
- Readable font sizes

---

## 12. Phase 10 — Feature Importance

Extract `model.feature_importances_`. Print top 10–20 ranked features. Save `outputs/feature_importance.png`.

> Note: Random Forest feature importance indicates which features contributed most to the classifier's decisions. It is not proof of causation.

---

## 13. Phase 11 — Model Serialization

Save using joblib: `models/fall_detector.joblib`

The saved artifact must contain:
- Trained model
- Feature names
- Sampling frequency
- Window size and overlap
- Feature configuration
- Dataset information
- Training/test subject IDs

The demo must verify that feature names and ordering match what the model expects.

---

## 14. Phase 12 — Live Demo (`demo_live_classification.py`)

This is **not** a simulation of a connected wearable. Must explicitly display:

```
SIMULATED / RECORDED DATA DEMO — no AltiLink hardware sensor is connected.
```

Demo uses **real windows from held-out test subjects** from the actual public dataset. Rules:

- ✅ Use 2–3 actual fall windows
- ✅ Use 2–3 actual normal/ADL windows from held-out subjects
- ❌ Do not generate fake/random accelerometer signals
- ❌ Do not fabricate fall examples
- ❌ Do not use training subjects

Example output format:

```
==================================================
ALTILINK FALL DETECTION — LIVE DEMO
==================================================

SIMULATED / RECORDED DATA DEMO
Public dataset: SisFall
No physical AltiLink wearable is connected.

Window 1
Subject       : TEST_SUBJECT_XX
True activity : FALL
True label    : FALL
Prediction    : FALL
Confidence    : 91.2%
Result        : ✓ CORRECT

==================================================
Demo complete.
These windows are real samples from held-out subjects in the public dataset.
==================================================
```

---

## 15. Phase 13 — Demo Window Selection

Use a **deterministic** mechanism:
- First available fall window from test subjects
- Another fall window from a different test subject (if possible)
- First normal window from test subjects
- Another normal window

Prefer examples from different subjects to reinforce subject-generalization methodology.

---

## 16. Phase 14 — Kalman Filter (Optional)

Do **not** force a Kalman implementation before the baseline pipeline works.

First validate: `raw IMU → windowing → DSP features → Random Forest`

Only propose Kalman as a second pipeline if the dataset provides synchronized accelerometer + gyroscope signals and the implementation is justified.

If implemented, compare honestly:
- Baseline (without Kalman) vs. Fusion (with Kalman)
- Same subject-wise test protocol for both
- Only claim improvement if actual measured results support it

---

## 17. Phase 15 — README Requirements

The README must contain:

1. Project title
2. What this ML subsystem does
3. Relationship to AltiLink
4. **Honest scope statement**
5. Dataset used (name, citation, exact source URL)
6. Why this dataset was selected
7. Dataset limitations
8. Installation instructions
9. Dataset setup/download instructions
10. Project structure
11. How to run each script
12. Feature extraction explanation
13. Window size and overlap
14. Subject-wise evaluation explanation
15. Random Forest explanation
16. Metrics, confusion matrix, feature importance
17. Live demo explanation
18. Reproducibility instructions
19. Limitations / future work
20. **Explicit statement that hardware validation has not happened yet**

**Required disclaimer wording:**

> "These results measure performance on the selected public dataset under a subject-wise hold-out protocol. They should not be interpreted as the final accuracy of the AltiLink wearable. Once real AltiLink IMU data is collected, the same preprocessing and classification pipeline must be retrained and evaluated on that device-specific data."

---

## 18. Phase 16 — Requirements (`requirements.txt`)

Minimum dependencies:

```
numpy
pandas
scipy
scikit-learn
matplotlib
joblib
```

Only add additional packages if actually necessary. Pin versions for reproducibility.

---

## 19. Phase 17 — Reliability Requirements

Priority order for this live-demo project:

1. Correctness
2. Reproducibility
3. Clear methodology
4. Simple installation
5. Fast demo
6. Good error messages
7. No hidden manual steps
8. No fabricated numbers

All scripts must fail loudly with helpful error messages for:
- Dataset directory missing
- Malformed dataset file
- No valid windows
- Only one class available
- Train/test subject overlap
- Model file missing
- Demo data missing

---

## 20. Phase 18 — Testing Checklist

Before declaring implementation complete, the full pipeline must be tested in sequence:

- [ ] Install requirements
- [ ] Verify dataset
- [ ] Run data loader; verify subject IDs and labels
- [ ] Extract windows; verify no subject boundary crossings
- [ ] Build feature matrix; verify no NaN/inf values
- [ ] Perform subject-wise split; verify zero subject overlap
- [ ] Train Random Forest
- [ ] Evaluate held-out subjects; print metrics
- [ ] Save confusion matrix
- [ ] Save feature importance
- [ ] Save model
- [ ] Run `demo_live_classification.py`
- [ ] Verify demo examples are genuinely from held-out subjects
- [ ] Verify demo uses exactly the same feature extraction pipeline
- [ ] Run everything a second time to confirm reproducibility

---

## 21. Anti-Gaming Rules (Non-Negotiable)

| Rule | Status |
|---|---|
| No random row-level train/test split | Required |
| No duplicated samples across train/test | Required |
| No subject overlap | Required |
| No fabricated data | Required |
| No fabricated accuracy | Required |
| No test-set tuning | Required |
| No cherry-picking correctly classified windows | Required |
| No deleting difficult test samples | Required |
| No label modification | Required |
| No hardware validation claims | Required |
| No real-world accuracy claims from public dataset | Required |
| No hard-coded accuracy numbers | Required |

---

## 22. Planning Response Required Before Implementation

**DO NOT CREATE FILES until the following planning audit is provided and approved.**

The implementation engineer must first return:

**A.** Current workspace status  
**B.** Relevant existing files  
**C.** Relevant AltiLink requirements found in reference documents  
**D.** Dataset comparison (SisFall vs MobiAct)  
**E.** Recommended dataset with justification  
**F.** Proposed architecture  
**G.** Proposed file tree  
**H.** Feature list  
**I.** Windowing configuration  
**J.** Subject-wise split strategy  
**K.** Model configuration  
**L.** Metrics/output plan  
**M.** Live demo plan  
**N.** Testing plan  
**O.** Potential problems / risks  
**P.** Exact commands planned  
**Q.** `WAITING FOR APPROVAL`

Only after explicit approval ("approved", "proceed", or "build it") may files be created or modified.

---

## 23. Evaluation Questions the Panel Will Ask

The final system must be defensible against:

- Why this dataset?
- Why Random Forest?
- Why these features?
- Why FFT?
- Why sliding windows?
- Why subject-wise splitting?
- How do you know the test data wasn't seen during training?
- What does the confusion matrix mean?
- Which features mattered?
- Is this trained on your actual hardware?
- If not, what exactly has been validated?
- How will you retrain it once the AltiLink wearable data exists?

---

*Document prepared for AltiLink — TRL 4–5 college integration project.*  
*Fall detection ML pipeline scope only. Hardware validation pending.*
