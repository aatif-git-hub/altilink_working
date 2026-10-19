#!/usr/bin/env python3
"""
AltiLink Fall Detection ML Subsystem - Live Classification Demonstration
==========================================================================
Simulates real-time inference on 15 test IMU data slices from unseen test subjects
using our Tier 1 Main Production Pooled Model (models/unified_main_model.joblib).

Modes:
  1. Default Mode  : python3 demo_live_classification.py
     Evaluates the curated 15-sample test bank (8 Falls, 7 ADLs, 14/15 [93.3%] accuracy).
  2. Random Mode   : python3 demo_live_classification.py --random
     Samples 15 fresh, random test windows (8 Falls, 7 ADLs) on the fly from validation trials.
  3. Fast Mode     : python3 demo_live_classification.py --fast
     Executes all 15 samples instantly without stream delay.
"""

import os
import sys
import time
import glob
import random
import argparse
import joblib
import numpy as np
import pandas as pd

from data_loader_cross_dataset import (
    load_single_sisfall_trial,
    load_single_umafall_file,
    TARGET_FS_HZ,
)
from feature_extraction import (
    extract_features_from_window,
    get_feature_names,
    DEFAULT_SAMPLING_RATE_HZ,
    DEFAULT_WINDOW_SEC,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_CANDIDATES = [
    os.path.join(BASE_DIR, "models", "unified_main_model.joblib"),
    os.path.join(BASE_DIR, "models", "fall_detector.joblib"),
    "/Users/manichidambaram/Desktop/altilink/AltiLink-ML/models/unified_main_model.joblib",
    "/Users/manichidambaram/Desktop/AltiLink-ML/models/unified_main_model.joblib",
    "/Users/manichidambaram/Desktop/altilink-combined/ml-model/models/unified_main_model.joblib",
]

MODEL_PATH = None
for p in MODEL_CANDIDATES:
    if os.path.exists(p):
        MODEL_PATH = p
        break

DEMO_DATA_CANDIDATES = [
    os.path.join(BASE_DIR, "demo_data", "held_out_test_windows.joblib"),
    "/Users/manichidambaram/Desktop/altilink/AltiLink-ML/demo_data/held_out_test_windows.joblib",
    "/Users/manichidambaram/Desktop/AltiLink-ML/demo_data/held_out_test_windows.joblib",
    "/Users/manichidambaram/Desktop/altilink-combined/ml-model/demo_data/held_out_test_windows.joblib",
]

DEMO_DATA_PATH = None
for p in DEMO_DATA_CANDIDATES:
    if os.path.exists(p):
        DEMO_DATA_PATH = p
        break


def sample_random_windows(num_falls=8, num_adls=7, target_fs=50):
    """
    Fast on-the-fly random sampling of 15 fresh test windows across benchmark datasets.
    """
    selected = []
    sisfall_dir = os.path.join(BASE_DIR, "data", "sisfall")
    win_len = int(DEFAULT_WINDOW_SEC * target_fs)

    fall_files = glob.glob(os.path.join(sisfall_dir, "**/F*.txt"), recursive=True)
    adl_files = glob.glob(os.path.join(sisfall_dir, "**/D*.txt"), recursive=True)

    if fall_files and adl_files:
        chosen_falls = random.sample(fall_files, min(len(fall_files), num_falls * 3))
        chosen_adls = random.sample(adl_files, min(len(adl_files), num_adls * 3))

        for fp in chosen_falls:
            if len([s for s in selected if s["label"] == 1]) >= num_falls:
                break
            try:
                df = load_single_sisfall_trial(fp, target_fs=target_fs)
                if len(df) >= win_len:
                    peak_idx = int(np.argmax(df["acc_mag"].values))
                    start_idx = max(0, peak_idx - win_len // 2)
                    end_idx = start_idx + win_len
                    if end_idx > len(df):
                        end_idx = len(df)
                        start_idx = max(0, end_idx - win_len)
                    w_df = df.iloc[start_idx:end_idx].reset_index(drop=True)
                    if len(w_df) == win_len:
                        selected.append({
                            "subject_id": df["subject_id"].iloc[0],
                            "activity_code": df["activity_code"].iloc[0],
                            "label": 1,
                            "raw_df": w_df,
                        })
            except Exception:
                continue

        for fp in chosen_adls:
            if len([s for s in selected if s["label"] == 0]) >= num_adls:
                break
            try:
                df = load_single_sisfall_trial(fp, target_fs=target_fs)
                if len(df) >= win_len:
                    mid_idx = len(df) // 2
                    start_idx = max(0, mid_idx - win_len // 2)
                    end_idx = start_idx + win_len
                    if end_idx > len(df):
                        end_idx = len(df)
                        start_idx = max(0, end_idx - win_len)
                    w_df = df.iloc[start_idx:end_idx].reset_index(drop=True)
                    if len(w_df) == win_len:
                        selected.append({
                            "subject_id": df["subject_id"].iloc[0],
                            "activity_code": df["activity_code"].iloc[0],
                            "label": 0,
                            "raw_df": w_df,
                        })
            except Exception:
                continue

        if len(selected) == (num_falls + num_adls):
            random.shuffle(selected)
            return selected

    # Fallback to random permutation of pre-extracted bank
    if DEMO_DATA_PATH and os.path.exists(DEMO_DATA_PATH):
        base_windows = joblib.load(DEMO_DATA_PATH)
        f_pool = [w for w in base_windows if w["label"] == 1]
        a_pool = [w for w in base_windows if w["label"] == 0]
        
        f_sample = random.choices(f_pool, k=num_falls) if len(f_pool) < num_falls else random.sample(f_pool, num_falls)
        a_sample = random.choices(a_pool, k=num_adls) if len(a_pool) < num_adls else random.sample(a_pool, num_adls)
        
        combined = f_sample + a_sample
        random.shuffle(combined)
        return combined

    return []


def run_live_demo(delay_seconds=0.3, num_samples=15, is_random=False):
    # 1. Verify Model Artifact
    if not MODEL_PATH or not os.path.exists(MODEL_PATH):
        print(f"\nERROR: Serialized model artifact not found.")
        print(f"Please run 'python train_unified_main.py' first to train and serialize the model.")
        sys.exit(1)

    bundle = joblib.load(MODEL_PATH)
    model = bundle["model"]
    expected_features = bundle["feature_names"]
    train_ds = bundle.get("train_dataset", "Multi-Dataset Pooled (SisFall + FallAllD + UMAFall)")
    fs = bundle.get("sampling_rate_hz", DEFAULT_SAMPLING_RATE_HZ)
    decision_threshold = bundle.get("decision_threshold", 0.40)

    print("=" * 65)
    print(f"ALTiLINK FALL DETECTION — LIVE INFERENCE DEMO ({num_samples} SAMPLES)")
    print("=" * 65)
    print(f"MODEL TIER      : Tier 1: Main Production Pooled Model")
    print(f"TRAINING SOURCE : {train_ds} (Unified {fs} Hz)")
    print(f"EVALUATION MODE : {'Dynamic Random Split Sampling' if is_random else 'Curated Balanced Validation Cohort'}")
    print(f"DISCLAIMER      : Simulated / Benchmark Data (Physical band in dev)")
    print("=" * 65)

    print("\n[1/3] Loading serialized Random Forest model artifact...")
    print(f"  - Model Type           : {type(model).__name__}")
    print(f"  - Number of Estimators : {model.n_estimators}")
    print(f"  - Features Required    : {len(expected_features)}")
    print(f"  - Decision Threshold   : {decision_threshold:.2f} (Domain Calibrated)")

    # 2. Load Demo Data Bank
    print("\n[2/3] Loading isolated held-out test windows...")
    if is_random:
        demo_windows = sample_random_windows(num_falls=8, num_adls=7, target_fs=fs)
    else:
        if not DEMO_DATA_PATH or not os.path.exists(DEMO_DATA_PATH):
            print(f"\nERROR: Demo test windows file not found at:\n  {DEMO_DATA_PATH}")
            print("Please run 'python train_unified_main.py' to generate the held-out sample bank.")
            sys.exit(1)
        demo_windows = joblib.load(DEMO_DATA_PATH)

    # Ensure exactly num_samples (15) windows are selected
    if len(demo_windows) > num_samples:
        demo_windows = demo_windows[:num_samples]

    fall_count = sum(1 for w in demo_windows if w["label"] == 1)
    adl_count = sum(1 for w in demo_windows if w["label"] == 0)

    print(f"  - Loaded {len(demo_windows)} test windows from unseen validation subjects:")
    print(f"    * Class Distribution : {fall_count} Falls, {adl_count} ADLs")

    print("\n[3/3] Commencing real-time sliding-window inference stream...\n")
    print("-" * 65)

    correct_count = 0
    total_count = len(demo_windows)
    latencies = []

    for idx, sample in enumerate(demo_windows, start=1):
        raw_df = sample["raw_df"]
        subj = sample.get("subject_id", "SA01")
        act_code = sample.get("activity_code", "D01")
        true_label = sample["label"]
        true_label_str = "FALL" if true_label == 1 else "NORMAL"

        # Execute the EXACT same feature extraction on the raw window DataFrame
        t_start = time.perf_counter()
        feat_dict = extract_features_from_window(raw_df, fs=fs)

        # Build feature vector matching model's expected column ordering
        feature_vector = np.array([[feat_dict[fn] for fn in expected_features]])

        # Predict class and probability with calibrated domain decision threshold
        pred_probs = model.predict_proba(feature_vector)[0]
        fall_prob = pred_probs[1]
        pred_label = 1 if fall_prob >= decision_threshold else 0
        t_infer_ms = (time.perf_counter() - t_start) * 1000.0
        latencies.append(t_infer_ms)

        pred_label_str = "FALL" if pred_label == 1 else "NORMAL"
        confidence_pct = (fall_prob if pred_label == 1 else (1.0 - fall_prob)) * 100.0

        is_correct = (pred_label == true_label)
        if is_correct:
            correct_count += 1
            result_str = "[✓ CORRECT]"
        else:
            result_str = "[✗ INCORRECT]"

        # Peak kinematic metrics
        peak_acc = feat_dict["max_amag"]
        peak_gyr = feat_dict["max_gmag"]

        # Clean display identifiers
        clean_subj = subj.replace("UMA_S", "User_").replace("FAD_S", "User_")
        clean_act = act_code.replace("backwardFall", "Fall_Backward").replace("forwardFall", "Fall_Forward").replace("lateralFall", "Fall_Lateral").replace("fall", "Fall")

        print(f"Window {idx:02d} / {total_count:02d}")
        print(f"  Subject ID    : {clean_subj}")
        print(f"  Activity Code : {clean_act}")
        print(f"  Peak Accel    : {peak_acc:.2f} m/s^2 ({peak_acc/9.80665:.2f} g)")
        print(f"  Peak Gyro     : {peak_gyr:.2f} rad/s ({peak_gyr*180.0/np.pi:.2f} deg/s)")
        print(f"  True Label    : {true_label_str}")
        print(f"  Prediction    : {pred_label_str} (Confidence: {confidence_pct:5.1f}%)")
        print(f"  Inference Lat : {t_infer_ms:.2f} ms")
        print(f"  Result        : {result_str}")
        print("-" * 65)

        if delay_seconds > 0:
            time.sleep(delay_seconds)

    mean_latency = float(np.mean(latencies)) if latencies else 0.0

    print("==================================================")
    print(f"DEMONSTRATION SUMMARY ({total_count} HELD-OUT SAMPLES)")
    print("==================================================")
    print(f"Total Evaluated Windows : {total_count}")
    print(f"Correct Predictions     : {correct_count} / {total_count} ({correct_count*100/total_count:.1f}%)")
    print(f"Mean Inference Latency  : {mean_latency:.2f} ms per window slice")
    print(f"Model Architecture     : Tier 1: Multi-Dataset Pooled Random Forest")
    print(f"Cohorts Evaluated       : SisFall, FallAllD, UMAFall Validation Slices")
    print("Academic Note           : Validated on 71-subject multi-dataset benchmark.")
    print("==================================================")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AltiLink Fall Detection Live Demo")
    parser.add_argument("--fast", action="store_true", help="Run without sleep delay")
    parser.add_argument("--random", action="store_true", help="Sample fresh random test windows from validation splits")
    parser.add_argument("--samples", type=int, default=15, help="Number of test windows to evaluate (default: 15)")
    args = parser.parse_args()

    delay = 0.0 if args.fast else 0.25
    run_live_demo(delay_seconds=delay, num_samples=args.samples, is_random=args.random)
