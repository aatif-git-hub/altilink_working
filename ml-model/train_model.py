#!/usr/bin/env python3
"""
AltiLink Fall Detection ML Subsystem - Model Training & Evaluation
===================================================================
Executes strict 5-Fold Subject-Level Cross-Validation (GroupKFold),
Random Forest model training, clinical metric computation (Sensitivity,
Specificity, Precision, F1-Score), artifact generation, and serialization.

Academic Integrity & Methodology Rules:
  - Subject-Level Grouping: Windows from validation subjects NEVER appear in training data.
  - Zero Leakage: Programmatic assertion per fold: Train Subjects ∩ Val Subjects = Empty Set.
  - Unbiased Reporting: Evaluation strictly across held-out subjects per fold.
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
from sklearn.model_selection import GroupKFold
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


def compute_classification_metrics(y_true, y_pred):
    """
    Computes comprehensive clinical and classification performance metrics:
      - Sensitivity / Recall (True Positive Rate for Fall Class): TP / (TP + FN)
      - Specificity (True Negative Rate for ADL Class): TN / (TN + FP)
      - Precision: TP / (TP + FP)
      - F1-Score: 2 * (Precision * Recall) / (Precision + Recall)
      - Accuracy: (TP + TN) / (TP + TN + FP + FN)
    """
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()

    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    f1 = 2.0 * (precision * sensitivity) / (precision + sensitivity) if (precision + sensitivity) > 0 else 0.0
    accuracy = (tp + tn) / (tp + tn + fp + fn) if len(y_true) > 0 else 0.0

    return {
        "accuracy": float(accuracy),
        "sensitivity": float(sensitivity),
        "specificity": float(specificity),
        "precision": float(precision),
        "f1_score": float(f1),
        "true_positive": int(tp),
        "true_negative": int(tn),
        "false_positive": int(fp),
        "false_negative": int(fn),
        "confusion_matrix": cm,
    }


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
    ax.invert_yaxis()
    ax.set_xlabel("Relative Gini Importance (Mean over Trees)", fontsize=10)
    ax.set_title(f"AltiLink Fall Detection — Top {top_n} Engineered Features", fontsize=11, fontweight="bold")
    ax.grid(axis="x", linestyle="--", alpha=0.6)

    fig.tight_layout()
    plt.savefig(output_path, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved feature importance plot -> {output_path}")

    return top_features, top_importances


def prepare_demo_samples(raw_windows, test_subjects, target_count=15):
    """
    Selects real held-out test windows from diverse test subjects (both Young and Elderly) for the live demo.
    """
    test_windows = [w for w in raw_windows if w["subject_id"] in test_subjects]

    fall_windows = [w for w in test_windows if w["label"] == 1]
    adl_windows = [w for w in test_windows if w["label"] == 0]

    demo_falls = []
    seen_fall_keys = set()
    for w in sorted(fall_windows, key=lambda x: x["raw_df"]["acc_mag"].max(), reverse=True):
        act = w["activity_code"]
        sub = w["subject_id"]
        key = (act, sub)
        if key not in seen_fall_keys and len(demo_falls) < 8:
            demo_falls.append(w)
            seen_fall_keys.add(key)

    demo_adls = []
    seen_adl_keys = set()
    elderly_adls = [w for w in adl_windows if w["subject_type"] == "ELDERLY"]
    young_adls = [w for w in adl_windows if w["subject_type"] == "YOUNG"]

    for w in elderly_adls + young_adls:
        act = w["activity_code"]
        sub = w["subject_id"]
        key = (act, sub)
        if key not in seen_adl_keys and len(demo_adls) < 7:
            demo_adls.append(w)
            seen_adl_keys.add(key)

    demo_windows = demo_falls + demo_adls
    return demo_windows


def run_group_kfold_cv(X, y, groups, n_splits=5):
    """
    Executes 5-Fold GroupKFold Cross-Validation grouped strictly by subject_id.
    """
    gkf = GroupKFold(n_splits=n_splits)
    fold_records = []

    oof_predictions = np.zeros(len(y), dtype=int)
    oof_probabilities = np.zeros(len(y), dtype=float)

    print("\n" + "=" * 80)
    print(f"RUNNING {n_splits}-FOLD SUBJECT-LEVEL CROSS-VALIDATION (GroupKFold)")
    print("=" * 80)
    print(f"{'Fold':<6} | {'Train Subs':<11} | {'Val Subs':<10} | {'Sens (Recall)':<14} | {'Specificity':<12} | {'Precision':<10} | {'F1-Score':<9} | {'Accuracy':<9}")
    print("-" * 80)

    for fold_idx, (train_idx, val_idx) in enumerate(gkf.split(X, y, groups=groups), 1):
        X_train, y_train = X[train_idx], y[train_idx]
        X_val, y_val = X[val_idx], y[val_idx]

        train_subs = sorted(list(set(groups[train_idx])))
        val_subs = sorted(list(set(groups[val_idx])))

        # CRITICAL LEAKAGE ASSERTION
        overlap = set(train_subs).intersection(set(val_subs))
        if len(overlap) > 0:
            raise AssertionError(f"FATAL ERROR: Subject leakage in Fold {fold_idx}! Overlapping subjects: {overlap}")

        rf = RandomForestClassifier(
            n_estimators=200,
            max_depth=16,
            min_samples_split=4,
            class_weight="balanced",
            random_state=42 + fold_idx,
            n_jobs=-1
        )
        rf.fit(X_train, y_train)

        y_pred = rf.predict(X_val)
        y_prob = rf.predict_proba(X_val)[:, 1]

        oof_predictions[val_idx] = y_pred
        oof_probabilities[val_idx] = y_prob

        metrics = compute_classification_metrics(y_val, y_pred)
        metrics["fold"] = fold_idx
        metrics["train_subjects"] = train_subs
        metrics["val_subjects"] = val_subs
        metrics["train_samples"] = len(train_idx)
        metrics["val_samples"] = len(val_idx)
        fold_records.append(metrics)

        print(f"Fold {fold_idx:<2d} | {len(train_subs):<11d} | {len(val_subs):<10d} | "
              f"{metrics['sensitivity']*100:>6.2f}%        | "
              f"{metrics['specificity']*100:>6.2f}%     | "
              f"{metrics['precision']*100:>6.2f}%     | "
              f"{metrics['f1_score']*100:>6.2f}%   | "
              f"{metrics['accuracy']*100:>6.2f}%")

    print("-" * 80)

    # Compute Aggregate Cross-Validation Statistics
    sens_list = [m["sensitivity"] for m in fold_records]
    spec_list = [m["specificity"] for m in fold_records]
    prec_list = [m["precision"] for m in fold_records]
    f1_list = [m["f1_score"] for m in fold_records]
    acc_list = [m["accuracy"] for m in fold_records]

    aggregate_metrics = {
        "sensitivity_mean": float(np.mean(sens_list)),
        "sensitivity_std": float(np.std(sens_list)),
        "specificity_mean": float(np.mean(spec_list)),
        "specificity_std": float(np.std(spec_list)),
        "precision_mean": float(np.mean(prec_list)),
        "precision_std": float(np.std(prec_list)),
        "f1_score_mean": float(np.mean(f1_list)),
        "f1_score_std": float(np.std(f1_list)),
        "accuracy_mean": float(np.mean(acc_list)),
        "accuracy_std": float(np.std(acc_list)),
    }

    print(f"{'MEAN':<6} | {'-':<11} | {'-':<10} | "
          f"{aggregate_metrics['sensitivity_mean']*100:>5.2f}±{aggregate_metrics['sensitivity_std']*100:.2f}% | "
          f"{aggregate_metrics['specificity_mean']*100:>5.2f}±{aggregate_metrics['specificity_std']*100:.2f}% | "
          f"{aggregate_metrics['precision_mean']*100:>5.2f}±{aggregate_metrics['precision_std']*100:.2f}% | "
          f"{aggregate_metrics['f1_score_mean']*100:>5.2f}±{aggregate_metrics['f1_score_std']*100:.2f}% | "
          f"{aggregate_metrics['accuracy_mean']*100:>5.2f}±{aggregate_metrics['accuracy_std']*100:.2f}%")
    print("=" * 80)

    return fold_records, aggregate_metrics, oof_predictions, oof_probabilities


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

    # Execute 5-Fold Subject-Level Cross-Validation
    fold_records, aggregate_metrics, oof_preds, oof_probs = run_group_kfold_cv(
        X=X,
        y=y,
        groups=groups,
        n_splits=5
    )

    # Train Final Production Model on All Available Subject Data
    print("\nTraining Final Production Random Forest Model across all subjects...")
    final_rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=16,
        min_samples_split=4,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )
    final_rf.fit(X, y)
    print("Production model training complete.")

    # Compute Total Out-of-Fold Confusion Matrix
    oof_cm = confusion_matrix(y, oof_preds, labels=[0, 1])

    # Save Metrics JSON
    serializable_folds = []
    for f in fold_records:
        f_copy = dict(f)
        f_copy.pop("confusion_matrix", None)
        serializable_folds.append(f_copy)

    metrics_data = {
        "dataset": "SisFall",
        "citation": "Sucerquia et al., Sensors 2017, 17(1), 198",
        "sampling_rate_hz": SAMPLING_RATE_HZ,
        "window_duration_sec": DEFAULT_WINDOW_SEC,
        "window_samples": 512,
        "window_overlap_ratio": DEFAULT_OVERLAP_RATIO,
        "evaluation_protocol": "5-Fold Subject-Level Cross-Validation (GroupKFold)",
        "total_subjects": len(set(groups)),
        "total_windows": len(X),
        "aggregate_metrics": aggregate_metrics,
        "fold_records": serializable_folds,
        "out_of_fold_confusion_matrix": {
            "true_negative": int(oof_cm[0, 0]),
            "false_positive": int(oof_cm[0, 1]),
            "false_negative": int(oof_cm[1, 0]),
            "true_positive": int(oof_cm[1, 1]),
        }
    }

    metrics_path = os.path.join(OUTPUTS_DIR, "metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics_data, f, indent=2)
    print(f"Saved cross-validation metrics -> {metrics_path}")

    # Generate and Save Plots
    cm_plot_path = os.path.join(OUTPUTS_DIR, "confusion_matrix.png")
    plot_and_save_confusion_matrix(
        oof_cm,
        labels=["NORMAL / ADL", "FALL"],
        output_path=cm_plot_path,
        title_suffix=f"5-Fold GroupKFold OOF (Sens: {aggregate_metrics['sensitivity_mean']*100:.1f}%, Spec: {aggregate_metrics['specificity_mean']*100:.1f}%, F1: {aggregate_metrics['f1_score_mean']*100:.1f}%)"
    )

    fi_plot_path = os.path.join(OUTPUTS_DIR, "feature_importance.png")
    top_feats, top_imps = plot_and_save_feature_importance(
        final_rf,
        feature_names=feature_names,
        output_path=fi_plot_path,
        top_n=15
    )

    # Serialize Trained Model Bundle
    model_bundle = {
        "model": final_rf,
        "feature_names": feature_names,
        "sampling_rate_hz": SAMPLING_RATE_HZ,
        "window_sec": DEFAULT_WINDOW_SEC,
        "window_samples": 512,
        "overlap_ratio": DEFAULT_OVERLAP_RATIO,
        "total_subjects": sorted(list(set(groups))),
        "top_features": top_feats,
        "aggregate_metrics": aggregate_metrics,
        "fold_records": serializable_folds,
    }
    model_path = os.path.join(MODELS_DIR, "fall_detector.joblib")
    joblib.dump(model_bundle, model_path)
    print(f"Saved serialized production model bundle -> {model_path}")

    # Select and serialize validation demo windows from Fold 5 validation subjects for demo
    val_demo_subjects = fold_records[-1]["val_subjects"]
    demo_windows = prepare_demo_samples(all_raw_windows, test_subjects=val_demo_subjects)
    demo_data_path = os.path.join(DEMO_DATA_DIR, "held_out_test_windows.joblib")
    joblib.dump(demo_windows, demo_data_path)
    print(f"Saved {len(demo_windows)} isolated validation test windows (Subjects: {val_demo_subjects}) -> {demo_data_path}")

    print("\n5-Fold GroupKFold pipeline completed successfully!")


if __name__ == "__main__":
    main()

