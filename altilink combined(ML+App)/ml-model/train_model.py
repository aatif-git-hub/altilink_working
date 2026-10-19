#!/usr/bin/env python3
"""
AltiLink Fall Detection ML Subsystem - Model Training & Evaluation
===================================================================
Executes strict subject-wise train/test partitioning, Random Forest model training,
metric computation, artifact generation, and serialization.

Academic Integrity & Methodology Rules:
  - Subject-Wise Holdout: Windows from test subjects NEVER appear in training data.
  - Zero Leakage: Programmatic verification that Train Subjects ∩ Test Subjects = Empty Set.
  - Unbiased Reporting: Evaluation strictly on held-out subjects. No test set cherry-picking.
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for server/CLI environments
import matplotlib.pyplot as plt

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report
)

from data_loader import load_all_sisfall_data, DEFAULT_DATA_DIR, SAMPLING_RATE_HZ
from feature_extraction import (
    build_feature_dataset,
    get_feature_names,
    DEFAULT_WINDOW_SEC,
    DEFAULT_OVERLAP_RATIO
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")
DEMO_DATA_DIR = os.path.join(BASE_DIR, "demo_data")


def plot_and_save_confusion_matrix(cm, labels, output_path, title_suffix=""):
    """
    Renders and saves a presentation-quality confusion matrix heatmap.
    """
    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    
    im = ax.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
    ax.figure.colorbar(im, ax=ax)
    
    ax.set(
        xticks=np.arange(cm.shape[1]),
        yticks=np.arange(cm.shape[0]),
        xticklabels=labels,
        yticklabels=labels,
        title=f"AltiLink Fall Detection — Confusion Matrix\n{title_suffix}",
        ylabel="True Label (Ground Truth)",
        xlabel="Predicted Label (Classifier)"
    )

    # Annotate cell values with count and percentage
    total = np.sum(cm)
    thresh = cm.max() / 2.0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            count = cm[i, j]
            pct = (count / total) * 100.0
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


def plot_and_save_feature_importance(model, feature_names, output_path, top_n=15):
    """
    Extracts tree feature importances and saves a ranked bar chart.
    """
    importances = model.feature_importances_
    std = np.std([tree.feature_importances_ for tree in model.estimators_], axis=0)
    
    indices = np.argsort(importances)[::-1][:top_n]
    top_features = [feature_names[i] for i in indices]
    top_importances = importances[indices]
    top_std = std[indices]

    fig, ax = plt.subplots(figsize=(8, 6), dpi=300)
    y_pos = np.arange(len(top_features))
    
    ax.barh(y_pos, top_importances, xerr=top_std, align="center", color="#1f77b4", ecolor="#d62728", capsize=3)
    ax.set_yticks(y_pos)
    ax.set_yticklabels(top_features, fontsize=9)
    ax.invert_yaxis()  # Top feature at top
    ax.set_xlabel("Relative Gini Importance (Mean over Trees)", fontsize=10)
    ax.set_title(f"AltiLink Fall Detection — Top {top_n} Engineered Features", fontsize=11, fontweight="bold")
    ax.grid(axis="x", linestyle="--", alpha=0.6)

    fig.tight_layout()
    plt.savefig(output_path, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved feature importance plot -> {output_path}")

    return top_features, top_importances


def prepare_demo_samples(raw_windows, test_subjects, max_samples_per_class=4):
    """
    Selects real held-out test windows from diverse test subjects for the live demo.
    """
    test_windows = [w for w in raw_windows if w["subject_id"] in test_subjects]
    
    fall_windows = [w for w in test_windows if w["label"] == 1]
    adl_windows = [w for w in test_windows if w["label"] == 0]

    # Select samples from different subjects deterministically
    demo_falls = []
    seen_fall_subjects = set()
    for w in fall_windows:
        if w["subject_id"] not in seen_fall_subjects:
            demo_falls.append(w)
            seen_fall_subjects.add(w["subject_id"])
            if len(demo_falls) >= max_samples_per_class:
                break

    demo_adls = []
    seen_adl_subjects = set()
    for w in adl_windows:
        if w["subject_id"] not in seen_adl_subjects:
            demo_adls.append(w)
            seen_adl_subjects.add(w["subject_id"])
            if len(demo_adls) >= max_samples_per_class:
                break

    demo_windows = demo_falls + demo_adls
    return demo_windows


def main():
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    os.makedirs(DEMO_DATA_DIR, exist_ok=True)

    print("==================================================")
    print("ALTiLINK FALL DETECTION — PIPELINE INITIALIZATION")
    print("==================================================")
    print("Loading SisFall benchmark dataset...")
    trials = load_all_sisfall_data(data_dir=DEFAULT_DATA_DIR, verbose=True)

    print("\nExtracting sliding-window DSP & FFT features...")
    df_features, all_raw_windows = build_feature_dataset(
        trials,
        window_sec=DEFAULT_WINDOW_SEC,
        overlap_ratio=DEFAULT_OVERLAP_RATIO,
        fs=SAMPLING_RATE_HZ,
        verbose=True
    )

    feature_names = get_feature_names(df_features)
    X = df_features[feature_names].values
    y = df_features["label"].values.astype(int)
    groups = df_features["subject_id"].values

    # Strict Subject-Wise Train/Test Split
    print("\nExecuting Subject-Wise Train/Test Split (Zero Subject Leakage)...")
    gss = GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=42)
    train_idx, test_idx = next(gss.split(X, y, groups=groups))

    X_train, y_train = X[train_idx], y[train_idx]
    X_test, y_test = X[test_idx], y[test_idx]

    train_subjects = sorted(list(set(groups[train_idx])))
    test_subjects = sorted(list(set(groups[test_idx])))

    # CRITICAL LEAKAGE ASSERTION
    overlap = set(train_subjects).intersection(set(test_subjects))
    if len(overlap) > 0:
        raise AssertionError(f"FATAL ERROR: Subject leakage detected! Overlapping subjects: {overlap}")

    print("==================================================")
    print(f"TRAIN SUBJECTS ({len(train_subjects)}): {train_subjects}")
    print(f"TEST SUBJECTS  ({len(test_subjects)}): {test_subjects}")
    print(f"Train Windows: {len(X_train)} (ADL: {np.sum(y_train==0)}, Fall: {np.sum(y_train==1)})")
    print(f"Test Windows : {len(X_test)} (ADL: {np.sum(y_test==0)}, Fall: {np.sum(y_test==1)})")
    print("Subject overlap verification: ZERO (Train ∩ Test = Empty Set) ✓")
    print("==================================================")

    # Train Random Forest Classifier
    print("\nTraining Random Forest Classifier on Training Subjects...")
    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=16,
        min_samples_split=4,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )
    rf.fit(X_train, y_train)
    print("Model training complete.")

    # Evaluate strictly on Held-Out Test Subjects
    print("\nEvaluating on Held-Out Test Subjects...")
    y_pred = rf.predict(X_test)
    y_prob = rf.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, pos_label=1, zero_division=0)
    rec = recall_score(y_test, y_pred, pos_label=1, zero_division=0)
    f1 = f1_score(y_test, y_pred, pos_label=1, zero_division=0)
    cm = confusion_matrix(y_test, y_pred)

    print("\n" + "=" * 50)
    print("ALTiLINK FALL DETECTION — TEST RESULTS")
    print("=" * 50)
    print("Dataset               : SisFall (200 Hz)")
    print(f"Sampling rate         : {SAMPLING_RATE_HZ} Hz")
    print(f"Window duration       : {DEFAULT_WINDOW_SEC} seconds (512 samples)")
    print(f"Window overlap        : {int(DEFAULT_OVERLAP_RATIO * 100)}%")
    print(f"Training subjects ({len(train_subjects):02d}): {train_subjects[:6]}... ({len(train_subjects)} total)")
    print(f"Held-out test subs ({len(test_subjects):02d}): {test_subjects}")
    print("-" * 50)
    print(f"Accuracy : {acc * 100:.2f}%")
    print(f"Precision: {prec * 100:.2f}% (Fall Class)")
    print(f"Recall   : {rec * 100:.2f}% (Fall Class)")
    print(f"F1-score : {f1 * 100:.2f}%")
    print("\nConfusion Matrix:")
    print(f"  [[TN={cm[0,0]:<5d}  FP={cm[0,1]:<5d}]")
    print(f"   [FN={cm[1,0]:<5d}  TP={cm[1,1]:<5d}]]")
    print("=" * 50)

    # Save Metrics JSON
    metrics_data = {
        "dataset": "SisFall",
        "citation": "Sucerquia et al., Sensors 2017, 17(1), 198",
        "sampling_rate_hz": SAMPLING_RATE_HZ,
        "window_duration_sec": DEFAULT_WINDOW_SEC,
        "window_samples": 512,
        "window_overlap_ratio": DEFAULT_OVERLAP_RATIO,
        "evaluation_protocol": "Subject-Wise Holdout (Zero Subject Leakage)",
        "train_subjects_count": len(train_subjects),
        "test_subjects_count": len(test_subjects),
        "train_subjects": train_subjects,
        "test_subjects": test_subjects,
        "test_windows_count": len(X_test),
        "test_metrics": {
            "accuracy": float(acc),
            "precision": float(prec),
            "recall": float(rec),
            "f1_score": float(f1),
            "confusion_matrix": {
                "true_negative": int(cm[0, 0]),
                "false_positive": int(cm[0, 1]),
                "false_negative": int(cm[1, 0]),
                "true_positive": int(cm[1, 1]),
            }
        }
    }

    metrics_path = os.path.join(OUTPUTS_DIR, "metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics_data, f, indent=2)
    print(f"Saved metrics -> {metrics_path}")

    # Generate and Save Plots
    cm_plot_path = os.path.join(OUTPUTS_DIR, "confusion_matrix.png")
    plot_and_save_confusion_matrix(
        cm,
        labels=["NORMAL / ADL", "FALL"],
        output_path=cm_plot_path,
        title_suffix=f"Subject-Wise Holdout (Acc: {acc*100:.1f}%, F1: {f1*100:.1f}%)"
    )

    fi_plot_path = os.path.join(OUTPUTS_DIR, "feature_importance.png")
    top_feats, top_imps = plot_and_save_feature_importance(
        rf,
        feature_names=feature_names,
        output_path=fi_plot_path,
        top_n=15
    )

    # Serialize Trained Model Bundle
    model_bundle = {
        "model": rf,
        "feature_names": feature_names,
        "sampling_rate_hz": SAMPLING_RATE_HZ,
        "window_sec": DEFAULT_WINDOW_SEC,
        "window_samples": 512,
        "overlap_ratio": DEFAULT_OVERLAP_RATIO,
        "train_subjects": train_subjects,
        "test_subjects": test_subjects,
        "top_features": top_feats,
        "metrics": metrics_data["test_metrics"],
    }
    model_path = os.path.join(MODELS_DIR, "fall_detector.joblib")
    joblib.dump(model_bundle, model_path)
    print(f"Saved serialized model bundle -> {model_path}")

    # Save isolated held-out test windows for live demo
    demo_windows = prepare_demo_samples(all_raw_windows, test_subjects=test_subjects)
    demo_data_path = os.path.join(DEMO_DATA_DIR, "held_out_test_windows.joblib")
    joblib.dump(demo_windows, demo_data_path)
    print(f"Saved {len(demo_windows)} isolated held-out test windows -> {demo_data_path}")

    print("\nTraining and evaluation pipeline finished successfully!")


if __name__ == "__main__":
    main()
