#!/usr/bin/env python3
"""
AltiLink Fall Detection ML Subsystem - Cross-Dataset Training & Zero-Shot Testing
==================================================================================
Trains on FallAllD (50 Hz) and evaluates Zero-Shot on UMAFall (50 Hz).
Computes domain generalization metrics: Sensitivity, Specificity, F1-Score, and Confusion Matrix.
Serializes the trained model bundle and extracts 15 balanced test windows from UMAFall for live demo.
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix
)

from data_loader_cross_dataset import (
    load_fallalld_dataset,
    load_umafall_dataset,
    DEFAULT_FALLALLD_DIR,
    DEFAULT_UMAFALL_DIR,
    TARGET_FS_HZ
)
from feature_extraction import (
    build_feature_dataset,
    get_feature_names,
    extract_features_from_window,
    DEFAULT_WINDOW_SEC,
    DEFAULT_OVERLAP_RATIO
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")
DEMO_DATA_DIR = os.path.join(BASE_DIR, "demo_data")


def plot_and_save_confusion_matrix(cm, labels, output_path, title_suffix=""):
    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    im = ax.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
    ax.figure.colorbar(im, ax=ax)
    
    ax.set(
        xticks=np.arange(cm.shape[1]),
        yticks=np.arange(cm.shape[0]),
        xticklabels=labels,
        yticklabels=labels,
        title=f"AltiLink Domain Generalization — Confusion Matrix\n{title_suffix}",
        ylabel="True Label (Ground Truth)",
        xlabel="Predicted Label (Classifier)"
    )

    total = np.sum(cm)
    thresh = cm.max() / 2.0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            count = cm[i, j]
            pct = (count / total) * 100.0 if total > 0 else 0.0
            text_str = f"{count}\n({pct:.1f}%)"
            ax.text(
                j, i, text_str,
                ha="center", va="center",
                color="white" if cm[i, j] > thresh else "black",
                fontsize=11, fontweight="bold"
            )

    fig.tight_layout()
    plt.savefig(output_path, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved confusion matrix plot -> {output_path}")


def extract_umafall_demo_windows(umafall_trials, num_samples=15):
    """
    Curates exactly 15 balanced, realistic test windows from UMAFall (8 Falls, 7 ADLs)
    with accurate Peak Accel and Peak Gyro metrics.
    """
    fall_trials = [t for t in umafall_trials if t["label"].iloc[0] == 1]
    adl_trials = [t for t in umafall_trials if t["label"].iloc[0] == 0]

    selected_windows = []

    # 1. Select 8 Falls across diverse subjects and fall types
    seen_fall_acts = set()
    for t in sorted(fall_trials, key=lambda df: df["acc_mag"].max(), reverse=True):
        act = t["activity_code"].iloc[0]
        sub = t["subject_id"].iloc[0]
        key = (act, sub)
        if key not in seen_fall_acts and len(selected_windows) < 8:
            # Segment window so impact peak occurs in first 0.6s, leaving 1.9s for post-fall stillness
            peak_idx = int(np.argmax(t["acc_mag"].values))
            win_len = int(DEFAULT_WINDOW_SEC * TARGET_FS_HZ)
            start_idx = max(0, peak_idx - int(0.5 * TARGET_FS_HZ))
            end_idx = start_idx + win_len
            if end_idx > len(t):
                end_idx = len(t)
                start_idx = max(0, end_idx - win_len)

            w_df = t.iloc[start_idx:end_idx].reset_index(drop=True)
            if len(w_df) == win_len:
                selected_windows.append({
                    "subject_id": sub,
                    "subject_type": "YOUNG",
                    "activity_code": act,
                    "trial_code": t["trial_code"].iloc[0],
                    "window_idx": 0,
                    "label": 1,
                    "raw_df": w_df,
                })
                seen_fall_acts.add(key)

    # 2. Select 7 ADLs across diverse activities
    seen_adl_acts = set()
    preferred_adls = ["Walking", "Jogging", "Sitting", "LyingDown", "Bending", "OpeningDoor", "MakingACall", "Aplausing", "HandsUp"]

    # Sort trials by preferred activities
    sorted_adl_trials = sorted(
        adl_trials,
        key=lambda t: preferred_adls.index(t["activity_code"].iloc[0]) if t["activity_code"].iloc[0] in preferred_adls else 99
    )

    for t in sorted_adl_trials:
        act = t["activity_code"].iloc[0]
        sub = t["subject_id"].iloc[0]
        if act not in seen_adl_acts and len(selected_windows) < num_samples:
            win_len = int(DEFAULT_WINDOW_SEC * TARGET_FS_HZ)
            mid_idx = len(t) // 2
            start_idx = max(0, mid_idx - win_len // 2)
            end_idx = start_idx + win_len
            if end_idx <= len(t):
                w_df = t.iloc[start_idx:end_idx].reset_index(drop=True)
                if len(w_df) == win_len:
                    selected_windows.append({
                        "subject_id": sub,
                        "subject_type": "YOUNG",
                        "activity_code": act,
                        "trial_code": t["trial_code"].iloc[0],
                        "window_idx": 0,
                        "label": 0,
                        "raw_df": w_df,
                    })
                    seen_adl_acts.add(act)

    return selected_windows


def main():
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    os.makedirs(DEMO_DATA_DIR, exist_ok=True)

    print("=================================================================")
    print("ALTiLINK CROSS-DATASET DOMAIN GENERALIZATION (FallAllD -> UMAFall)")
    print("=================================================================")
    print(f"Target Unified Sampling Rate: {TARGET_FS_HZ} Hz")
    print(f"Window Duration             : {DEFAULT_WINDOW_SEC} s ({int(DEFAULT_WINDOW_SEC*TARGET_FS_HZ)} samples)")
    print(f"Window Overlap              : {int(DEFAULT_OVERLAP_RATIO*100)}%")
    print("=================================================================")

    # 1. Ingest and Resample FallAllD (Training Set)
    print("\n[1/4] Ingesting & Harmonizing FallAllD (Training Cohort)...")
    fallalld_trials = load_fallalld_dataset(DEFAULT_FALLALLD_DIR, device="D1", target_fs=TARGET_FS_HZ, verbose=True)

    print("\n[2/4] Extracting DSP features from FallAllD...")
    df_features_train, _ = build_feature_dataset(
        fallalld_trials,
        window_sec=DEFAULT_WINDOW_SEC,
        overlap_ratio=DEFAULT_OVERLAP_RATIO,
        fs=TARGET_FS_HZ,
        verbose=True
    )

    feature_names = get_feature_names(df_features_train)
    X_train = df_features_train[feature_names].values
    y_train = df_features_train["label"].values.astype(int)

    # 2. Train Random Forest Classifier on FallAllD
    print("\n[3/4] Training Random Forest Classifier on FallAllD...")
    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=16,
        min_samples_split=4,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )
    rf.fit(X_train, y_train)
    print("Training complete.")

    # 3. Ingest and Resample UMAFall (Zero-Shot Testing Set)
    print("\n[4/4] Ingesting & Harmonizing UMAFall (Unseen Zero-Shot Test Cohort)...")
    umafall_trials = load_umafall_dataset(DEFAULT_UMAFALL_DIR, target_fs=TARGET_FS_HZ, verbose=True)

    df_features_test, all_umafall_windows = build_feature_dataset(
        umafall_trials,
        window_sec=DEFAULT_WINDOW_SEC,
        overlap_ratio=DEFAULT_OVERLAP_RATIO,
        fs=TARGET_FS_HZ,
        verbose=True
    )

    X_test = df_features_test[feature_names].values
    y_test = df_features_test["label"].values.astype(int)

    # 4. Zero-Shot Evaluation on UMAFall
    y_pred = rf.predict(X_test)
    y_prob = rf.predict_proba(X_test)[:, 1]

    cm = confusion_matrix(y_test, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()

    acc = (tp + tn) / (tp + tn + fp + fn) if len(y_test) > 0 else 0.0
    sens = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    f1 = 2.0 * (prec * sens) / (prec + sens) if (prec + sens) > 0 else 0.0

    print("\n" + "=" * 65)
    print("CROSS-DATASET ZERO-SHOT EVALUATION RESULTS (FallAllD -> UMAFall)")
    print("=" * 65)
    print(f"Training Source       : FallAllD ({len(fallalld_trials)} trials, {len(X_train)} windows)")
    print(f"Evaluation Target     : UMAFall ({len(umafall_trials)} trials, {len(X_test)} windows)")
    print(f"Sampling Rate         : {TARGET_FS_HZ} Hz unified")
    print("-" * 65)
    print(f"Accuracy              : {acc * 100:.2f}%")
    print(f"Sensitivity (Recall)  : {sens * 100:.2f}% (Fall Class)")
    print(f"Specificity           : {spec * 100:.2f}% (ADL Class)")
    print(f"Precision             : {prec * 100:.2f}% (Fall Class)")
    print(f"F1-Score              : {f1 * 100:.2f}%")
    print("\nConfusion Matrix:")
    print(f"  [[TN={tn:<5d}  FP={fp:<5d}]")
    print(f"   [FN={fn:<5d}  TP={tp:<5d}]]")
    print("=" * 65)

    # Save Metrics JSON
    metrics_data = {
        "protocol": "Cross-Dataset Domain Generalization (Zero-Shot)",
        "train_dataset": "FallAllD",
        "test_dataset": "UMAFall",
        "sampling_rate_hz": TARGET_FS_HZ,
        "window_duration_sec": DEFAULT_WINDOW_SEC,
        "window_samples": int(DEFAULT_WINDOW_SEC * TARGET_FS_HZ),
        "train_trials_count": len(fallalld_trials),
        "test_trials_count": len(umafall_trials),
        "train_windows_count": len(X_train),
        "test_windows_count": len(X_test),
        "metrics": {
            "accuracy": float(acc),
            "sensitivity": float(sens),
            "specificity": float(spec),
            "precision": float(prec),
            "f1_score": float(f1),
            "confusion_matrix": {
                "true_negative": int(tn),
                "false_positive": int(fp),
                "false_negative": int(fn),
                "true_positive": int(tp),
            }
        }
    }

    metrics_path = os.path.join(OUTPUTS_DIR, "fallalld_to_umafall_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics_data, f, indent=2)
    print(f"Saved metrics -> {metrics_path}")

    # Save Confusion Matrix Plot
    cm_plot_path = os.path.join(OUTPUTS_DIR, "fallalld_to_umafall_cm.png")
    plot_and_save_confusion_matrix(
        cm,
        labels=["NORMAL / ADL", "FALL"],
        output_path=cm_plot_path,
        title_suffix=f"FallAllD -> UMAFall Zero-Shot (Sens: {sens*100:.1f}%, Spec: {spec*100:.1f}%, F1: {f1*100:.1f}%)"
    )

    # Save Model Bundle
    model_bundle = {
        "model": rf,
        "feature_names": feature_names,
        "sampling_rate_hz": TARGET_FS_HZ,
        "window_sec": DEFAULT_WINDOW_SEC,
        "window_samples": int(DEFAULT_WINDOW_SEC * TARGET_FS_HZ),
        "decision_threshold": 0.40,
        "train_dataset": "FallAllD",
        "test_dataset": "UMAFall",
        "metrics": metrics_data["metrics"],
    }
    model_path = os.path.join(MODELS_DIR, "fallalld_trained_model.joblib")
    joblib.dump(model_bundle, model_path)
    print(f"Saved model bundle -> {model_path}")

    # Also sync to default fall_detector.joblib for seamless live inference demo
    default_model_path = os.path.join(MODELS_DIR, "fall_detector.joblib")
    joblib.dump(model_bundle, default_model_path)
    print(f"Saved default model bundle -> {default_model_path}")

    # 5. Extract 15 Balanced Test Windows from UMAFall
    demo_windows = extract_umafall_demo_windows(umafall_trials, num_samples=15)
    demo_data_path = os.path.join(DEMO_DATA_DIR, "held_out_test_windows.joblib")
    joblib.dump(demo_windows, demo_data_path)
    print(f"Saved {len(demo_windows)} balanced UMAFall test windows -> {demo_data_path}")

    print("\nCross-dataset pipeline completed successfully!")


if __name__ == "__main__":
    main()
