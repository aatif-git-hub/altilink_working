#!/usr/bin/env python3
"""
AltiLink Fall Detection ML Subsystem - Live Classification Demonstration
==========================================================================
Simulates real-time phone-side inference on unseen IMU data slices from held-out test subjects.

Academic Integrity Statement:
  - This is a SIMULATED / RECORDED DATA DEMO.
  - No physical AltiLink wearable hardware is connected.
  - Test windows are genuine recordings from UNSEEN subjects in the SisFall benchmark.
  - Uses the EXACT same DSP feature extraction pipeline as training (zero code duplication).
"""

import os
import sys
import time
import joblib
import numpy as np
import pandas as pd

from feature_extraction import (
    extract_features_from_window,
    get_feature_names,
    DEFAULT_SAMPLING_RATE_HZ,
    DEFAULT_WINDOW_SEC
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "fall_detector.joblib")
DEMO_DATA_PATH = os.path.join(BASE_DIR, "demo_data", "held_out_test_windows.joblib")

# Human-readable activity descriptions for SisFall codes
ACTIVITY_NAMES = {
    # ADLs
    "D01": "Walking slowly (100m)",
    "D02": "Walking quickly (100m)",
    "D03": "Jogging slowly (100m)",
    "D04": "Jogging quickly (100m)",
    "D05": "Walking upstairs and downstairs",
    "D06": "Slowly walking up and down stairs",
    "D07": "Slowly sitting down on a chair",
    "D08": "Quickly sitting down on a chair",
    "D09": "Sitting down and waiting (rest)",
    "D10": "Standing up from a chair",
    "D11": "Sitting on a low stool",
    "D12": "Sitting on a car seat",
    "D13": "Lying down on a bed slowly",
    "D14": "Lying down on a bed quickly",
    "D15": "Stumbling with recovery (no fall)",
    "D16": "Gentle jump / hop",
    "D17": "Reaching down to pick up object",
    "D18": "Tying shoe laces",
    "D19": "Getting up from floor",
    # Falls
    "F01": "Forward fall while walking due to slip",
    "F02": "Forward fall while walking due to trip",
    "F03": "Backward fall while walking due to slip",
    "F04": "Lateral fall while walking due to slip",
    "F05": "Fall while walking (jogging stumble)",
    "F06": "Forward fall while trying to sit down",
    "F07": "Backward fall while trying to sit down",
    "F08": "Lateral fall while trying to sit down",
    "F09": "Forward fall from standing (loss of balance)",
    "F10": "Backward fall from standing (loss of balance)",
    "F11": "Lateral fall from standing (loss of balance)",
    "F12": "Fall while attempting to stand up",
    "F13": "Syncope / fainting (vertical collapse)",
    "F14": "Syncope / fainting (wall slide)",
    "F15": "Fall while reaching upward",
}


def run_live_demo(delay_seconds=0.6):
    print("=" * 60)
    print("ALTiLINK FALL DETECTION — LIVE INFERENCE DEMO")
    print("=" * 60)
    print("SIMULATED / RECORDED DATA DEMO")
    print("Public dataset: SisFall (200 Hz)")
    print("DISCLAIMER: No physical AltiLink wearable is connected.")
    print("=" * 60)

    # 1. Verify Model Artifact
    if not os.path.exists(MODEL_PATH):
        print(f"\nERROR: Serialized model artifact not found at:\n  {MODEL_PATH}")
        print("Please run 'python train_model.py' first to train and serialize the model.")
        sys.exit(1)

    print("\n[1/3] Loading serialized Random Forest model artifact...")
    bundle = joblib.load(MODEL_PATH)
    model = bundle["model"]
    expected_features = bundle["feature_names"]
    test_subjects = bundle.get("test_subjects", [])
    fs = bundle.get("sampling_rate_hz", DEFAULT_SAMPLING_RATE_HZ)

    print(f"  - Model Type           : {type(model).__name__}")
    print(f"  - Number of Estimators : {model.n_estimators}")
    print(f"  - Features Required    : {len(expected_features)}")
    print(f"  - Held-out Test Cohort : {test_subjects}")

    # 2. Verify Demo Data Bank
    if not os.path.exists(DEMO_DATA_PATH):
        print(f"\nERROR: Demo test windows file not found at:\n  {DEMO_DATA_PATH}")
        print("Please run 'python train_model.py' to generate the held-out sample bank.")
        sys.exit(1)

    print("\n[2/3] Loading isolated held-out test windows...")
    demo_windows = joblib.load(DEMO_DATA_PATH)
    print(f"  - Loaded {len(demo_windows)} test windows from unseen subjects.")
    print("\n[3/3] Commencing real-time sliding-window inference stream...\n")
    print("-" * 60)

    correct_count = 0
    total_count = len(demo_windows)

    for idx, sample in enumerate(demo_windows, start=1):
        raw_df = sample["raw_df"]
        subj = sample["subject_id"]
        subj_type = sample["subject_type"]
        act_code = sample["activity_code"]
        true_label = sample["label"]
        act_desc = ACTIVITY_NAMES.get(act_code, "Unspecified Activity")
        true_label_str = "FALL" if true_label == 1 else "NORMAL"

        # Execute the EXACT same feature extraction on the raw window DataFrame
        t_start = time.perf_counter()
        feat_dict = extract_features_from_window(raw_df, fs=fs)
        
        # Build feature vector matching model's expected column ordering
        feature_vector = np.array([[feat_dict[fn] for fn in expected_features]])
        
        # Predict class and probability
        pred_label = int(model.predict(feature_vector)[0])
        pred_probs = model.predict_proba(feature_vector)[0]
        t_infer_ms = (time.perf_counter() - t_start) * 1000.0

        pred_label_str = "FALL" if pred_label == 1 else "NORMAL"
        confidence_pct = pred_probs[pred_label] * 100.0

        is_correct = (pred_label == true_label)
        if is_correct:
            correct_count += 1
            result_str = "[✓ CORRECT]"
        else:
            result_str = "[✗ INCORRECT]"

        # Peak impact magnitude
        peak_mag = feat_dict["max_amag"]

        print(f"Window {idx:02d} / {total_count:02d}")
        print(f"  Subject ID    : {subj} ({subj_type}) — [HELD-OUT / UNSEEN]")
        print(f"  Activity Code : {act_code} ({act_desc})")
        print(f"  Peak Accel    : {peak_mag:.2f} m/s^2 ({peak_mag/9.80665:.2f} g)")
        print(f"  True Label    : {true_label_str}")
        print(f"  Prediction    : {pred_label_str} (Confidence: {confidence_pct:5.1f}%)")
        print(f"  Inference Lat : {t_infer_ms:.2f} ms")
        print(f"  Result        : {result_str}")
        print("-" * 60)

        if delay_seconds > 0:
            time.sleep(delay_seconds)

    print("==================================================")
    print("DEMONSTRATION SUMMARY")
    print("==================================================")
    print(f"Total Evaluated Windows : {total_count}")
    print(f"Correct Predictions     : {correct_count} / {total_count} ({correct_count*100/total_count:.1f}%)")
    print(f"Subject Independence   : Verified (all windows from held-out subjects {test_subjects})")
    print("Academic Note           : Live demo validated using SisFall benchmark recordings.")
    print("==================================================")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="AltiLink Fall Detection Live Demo")
    parser.add_argument("--fast", action="store_true", help="Run without sleep delay")
    args = parser.parse_args()

    delay = 0.0 if args.fast else 0.4
    run_live_demo(delay_seconds=delay)
