#!/usr/bin/env python3
"""
AltiLink Fall Detection ML Subsystem - Tier 2: Single-Dataset SisFall Baseline
==============================================================================
Evaluates Random Forest Classifier strictly on the SisFall benchmark dataset
using 5-Fold GroupKFold cross-validation (grouped strictly by Subject ID).
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupKFold
from sklearn.metrics import (
    accuracy_score,
    recall_score,
    precision_score,
    f1_score,
    confusion_matrix,
)

from data_loader_cross_dataset import load_sisfall_dataset, TARGET_FS_HZ
from feature_extraction import (
    build_feature_dataset,
    get_feature_names,
    DEFAULT_WINDOW_SEC,
    DEFAULT_OVERLAP_RATIO,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")


def plot_and_save_confusion_matrix(cm, labels, output_path, title_suffix=""):
    fig, ax = plt.subplots(figsize=(6, 5), dpi=150)
    cax = ax.matshow(cm, cmap="Greens")
    fig.colorbar(cax)
    ax.set_xticks([0, 1])
    ax.set_yticks([0, 1])
    ax.set_xticklabels(labels, fontsize=10, fontweight="bold")
    ax.set_yticklabels(labels, fontsize=10, fontweight="bold")
    for i in range(2):
        for j in range(2):
            val = cm[i, j]
            ax.text(j, i, f"{val:,}", ha="center", va="center", color="white" if val > np.max(cm)/2 else "black", fontsize=14, fontweight="bold")
    ax.set_title(f"AltiLink SisFall Baseline - Confusion Matrix\n{title_suffix}", fontsize=11, fontweight="bold", pad=12)
    ax.set_ylabel("True Ground Truth Label", fontsize=10, fontweight="bold")
    ax.set_xlabel("Predicted Label", fontsize=10, fontweight="bold")
    plt.tight_layout()
    plt.savefig(output_path, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved confusion matrix plot -> {output_path}")


def main():
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(OUTPUTS_DIR, exist_ok=True)

    print("=================================================================")
    print("ALTiLINK TIER 2: SINGLE-DATASET SISFALL BASELINE (5-FOLD CV)")
    print("=================================================================")
    print(f"Dataset              : SisFall (38 Subjects: 23 SA Young, 15 SE Elderly)")
    print(f"Target Sampling Rate : {TARGET_FS_HZ} Hz unified")
    print(f"Sliding Window       : {DEFAULT_WINDOW_SEC}s ({int(DEFAULT_WINDOW_SEC * TARGET_FS_HZ)} samples, 50% overlap)")
    print("=================================================================\n")

    # 1. Load SisFall
    sisfall_trials = load_sisfall_dataset(target_fs=TARGET_FS_HZ, verbose=True)

    # 2. Extract features
    print("\n[1/3] Extracting orientation-invariant features from SisFall...")
    df_features, _ = build_feature_dataset(
        sisfall_trials,
        window_sec=DEFAULT_WINDOW_SEC,
        overlap_ratio=DEFAULT_OVERLAP_RATIO,
        fs=TARGET_FS_HZ,
        verbose=True
    )

    feature_names = get_feature_names(df_features)
    X = df_features[feature_names].values
    y = df_features["label"].values.astype(int)
    groups = df_features["subject_id"].values

    unique_subjects = np.unique(groups)
    print(f"\nExtracted Feature Matrix: {X.shape[0]} windows x {X.shape[1]} features across {len(unique_subjects)} subjects.")

    # 3. 5-Fold GroupKFold Cross-Validation
    print("\n[2/3] Executing 5-Fold GroupKFold Cross-Validation...")
    gkf = GroupKFold(n_splits=5)
    fold_metrics = []
    total_cm = np.zeros((2, 2), dtype=int)

    for fold_idx, (train_idx, val_idx) in enumerate(gkf.split(X, y, groups=groups), start=1):
        X_train, y_train = X[train_idx], y[train_idx]
        X_val, y_val = X[val_idx], y[val_idx]
        train_subjs = set(groups[train_idx])
        val_subjs = set(groups[val_idx])

        overlap = train_subjs.intersection(val_subjs)
        assert len(overlap) == 0, f"Subject leakage detected in Fold {fold_idx}: {overlap}"

        rf_fold = RandomForestClassifier(
            n_estimators=200,
            max_depth=16,
            min_samples_split=4,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=42 + fold_idx,
            n_jobs=-1
        )
        rf_fold.fit(X_train, y_train)

        y_prob_val = rf_fold.predict_proba(X_val)[:, 1]
        y_pred_val = (y_prob_val >= 0.40).astype(int)

        cm_fold = confusion_matrix(y_val, y_pred_val, labels=[0, 1])
        total_cm += cm_fold
        tn, fp, fn, tp = cm_fold.ravel()

        acc = accuracy_score(y_val, y_pred_val)
        sens = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        f1 = 2.0 * (prec * sens) / (prec + sens) if (prec + sens) > 0 else 0.0

        fold_metrics.append({
            "fold": fold_idx,
            "val_subjects_count": len(val_subjs),
            "val_samples": len(y_val),
            "accuracy": acc,
            "sensitivity": sens,
            "specificity": spec,
            "precision": prec,
            "f1_score": f1,
            "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}
        })

        print(f"Fold {fold_idx}/5 | Val Subjs: {len(val_subjs):2d} ({len(y_val):5d} wins) | "
              f"Acc: {acc*100:5.2f}% | Sens: {sens*100:5.2f}% | Spec: {spec*100:5.2f}% | F1: {f1*100:5.2f}%")

    print("=" * 70)

    mean_acc = float(np.mean([m["accuracy"] for m in fold_metrics]))
    std_acc = float(np.std([m["accuracy"] for m in fold_metrics]))
    mean_sens = float(np.mean([m["sensitivity"] for m in fold_metrics]))
    std_sens = float(np.std([m["sensitivity"] for m in fold_metrics]))
    mean_spec = float(np.mean([m["specificity"] for m in fold_metrics]))
    std_spec = float(np.std([m["specificity"] for m in fold_metrics]))
    mean_prec = float(np.mean([m["precision"] for m in fold_metrics]))
    std_prec = float(np.std([m["precision"] for m in fold_metrics]))
    mean_f1 = float(np.mean([m["f1_score"] for m in fold_metrics]))
    std_f1 = float(np.std([m["f1_score"] for m in fold_metrics]))

    print(f"SISFALL BASELINE 5-FOLD CV PERFORMANCE (MEAN +/- STD):")
    print(f"  - Accuracy              : {mean_acc*100:5.2f}% +/- {std_acc*100:.2f}%")
    print(f"  - Sensitivity (Recall)  : {mean_sens*100:5.2f}% +/- {std_sens*100:.2f}%")
    print(f"  - Specificity (TNR)     : {mean_spec*100:5.2f}% +/- {std_spec*100:.2f}%")
    print(f"  - Precision             : {mean_prec*100:5.2f}% +/- {std_prec*100:.2f}%")
    print(f"  - F1-Score              : {mean_f1*100:5.2f}% +/- {std_f1*100:.2f}%")
    print("=" * 70)

    # 4. Train model on full SisFall
    print("\n[3/3] Training final SisFall baseline model...")
    rf_sisfall = RandomForestClassifier(
        n_estimators=200,
        max_depth=16,
        min_samples_split=4,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )
    rf_sisfall.fit(X, y)

    metrics_data = {
        "tier": "Tier 2: Single-Dataset SisFall Baseline",
        "description": "Baseline model trained and cross-validated on SisFall dataset",
        "sampling_rate_hz": TARGET_FS_HZ,
        "window_duration_sec": DEFAULT_WINDOW_SEC,
        "total_windows": len(X),
        "total_subjects": len(unique_subjects),
        "feature_count": len(feature_names),
        "decision_threshold": 0.40,
        "cv_scheme": "5-Fold GroupKFold (grouped strictly by subject_id)",
        "aggregate_metrics": {
            "accuracy": {"mean": mean_acc, "std": std_acc},
            "sensitivity": {"mean": mean_sens, "std": std_sens},
            "specificity": {"mean": mean_spec, "std": std_spec},
            "precision": {"mean": mean_prec, "std": std_prec},
            "f1_score": {"mean": mean_f1, "std": std_f1},
        },
        "aggregate_confusion_matrix": {
            "true_negative": int(total_cm[0,0]),
            "false_positive": int(total_cm[0,1]),
            "false_negative": int(total_cm[1,0]),
            "true_positive": int(total_cm[1,1]),
        },
        "folds": fold_metrics,
    }

    metrics_path = os.path.join(OUTPUTS_DIR, "sisfall_baseline_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics_data, f, indent=2)
    print(f"Saved metrics -> {metrics_path}")

    cm_plot_path = os.path.join(OUTPUTS_DIR, "sisfall_baseline_cm.png")
    plot_and_save_confusion_matrix(
        total_cm,
        labels=["NORMAL / ADL", "FALL"],
        output_path=cm_plot_path,
        title_suffix=f"SisFall Baseline (Sens: {mean_sens*100:.1f}%, Spec: {mean_spec*100:.1f}%, F1: {mean_f1*100:.1f}%)"
    )

    model_bundle = {
        "model": rf_sisfall,
        "feature_names": feature_names,
        "sampling_rate_hz": TARGET_FS_HZ,
        "window_sec": DEFAULT_WINDOW_SEC,
        "window_samples": int(DEFAULT_WINDOW_SEC * TARGET_FS_HZ),
        "decision_threshold": 0.40,
        "train_dataset": "SisFall",
        "test_dataset": "5-Fold Subject-Level GroupKFold CV",
        "metrics": metrics_data["aggregate_metrics"],
    }
    model_path = os.path.join(MODELS_DIR, "sisfall_baseline_model.joblib")
    joblib.dump(model_bundle, model_path)
    print(f"Saved SisFall model bundle -> {model_path}")
    print("\nSisFall baseline pipeline completed successfully!")


if __name__ == "__main__":
    main()
