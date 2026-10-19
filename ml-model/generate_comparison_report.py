#!/usr/bin/env python3
"""
AltiLink Fall Detection ML Subsystem - 3-Tier Comparative Benchmark Report
===========================================================================
Reads performance metrics across:
  Tier 1: Main Production Pooled Model (SisFall + FallAllD + UMAFall)
  Tier 2: Single-Dataset Baseline (SisFall 5-Fold GroupKFold)
  Tier 3: Cross-Domain Zero-Shot Transfer (FallAllD -> UMAFall)

Outputs comparative summary table and saves outputs/model_benchmarks_summary.json.
"""

import os
import json
import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")


def load_json_safe(path):
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception:
        return None


def main():
    t1_path = os.path.join(OUTPUTS_DIR, "unified_main_metrics.json")
    t2_path = os.path.join(OUTPUTS_DIR, "sisfall_baseline_metrics.json")
    t3_path = os.path.join(OUTPUTS_DIR, "fallalld_to_umafall_metrics.json")

    t1_data = load_json_safe(t1_path)
    t2_data = load_json_safe(t2_path)
    t3_data = load_json_safe(t3_path)

    summary_records = []

    # Process Tier 1
    if t1_data:
        m = t1_data["aggregate_metrics"]
        cm = t1_data.get("aggregate_confusion_matrix", {})
        summary_records.append({
            "tier": "Tier 1: Main Production (Pooled)",
            "training_source": "SisFall + FallAllD + UMAFall",
            "evaluation_target": "5-Fold GroupKFold (71 Subjects)",
            "windows_count": t1_data.get("total_windows", 0),
            "subjects_count": t1_data.get("total_subjects", 71),
            "sampling_rate": f"{t1_data.get('sampling_rate_hz', 50)} Hz",
            "accuracy": f"{m['accuracy']['mean']*100:.2f}% ± {m['accuracy']['std']*100:.2f}%",
            "sensitivity": f"{m['sensitivity']['mean']*100:.2f}% ± {m['sensitivity']['std']*100:.2f}%",
            "specificity": f"{m['specificity']['mean']*100:.2f}% ± {m['specificity']['std']*100:.2f}%",
            "precision": f"{m['precision']['mean']*100:.2f}% ± {m['precision']['std']*100:.2f}%",
            "f1_score": f"{m['f1_score']['mean']*100:.2f}% ± {m['f1_score']['std']*100:.2f}%",
            "accuracy_val": m['accuracy']['mean'],
            "sensitivity_val": m['sensitivity']['mean'],
            "specificity_val": m['specificity']['mean'],
            "precision_val": m['precision']['mean'],
            "f1_val": m['f1_score']['mean'],
            "confusion_matrix": cm,
        })

    # Process Tier 2
    if t2_data:
        m = t2_data["aggregate_metrics"]
        cm = t2_data.get("aggregate_confusion_matrix", {})
        summary_records.append({
            "tier": "Tier 2: Single-Dataset Baseline",
            "training_source": "SisFall",
            "evaluation_target": "5-Fold GroupKFold (38 Subjects)",
            "windows_count": t2_data.get("total_windows", 0),
            "subjects_count": t2_data.get("total_subjects", 38),
            "sampling_rate": f"{t2_data.get('sampling_rate_hz', 50)} Hz",
            "accuracy": f"{m['accuracy']['mean']*100:.2f}% ± {m['accuracy']['std']*100:.2f}%",
            "sensitivity": f"{m['sensitivity']['mean']*100:.2f}% ± {m['sensitivity']['std']*100:.2f}%",
            "specificity": f"{m['specificity']['mean']*100:.2f}% ± {m['specificity']['std']*100:.2f}%",
            "precision": f"{m['precision']['mean']*100:.2f}% ± {m['precision']['std']*100:.2f}%",
            "f1_score": f"{m['f1_score']['mean']*100:.2f}% ± {m['f1_score']['std']*100:.2f}%",
            "accuracy_val": m['accuracy']['mean'],
            "sensitivity_val": m['sensitivity']['mean'],
            "specificity_val": m['specificity']['mean'],
            "precision_val": m['precision']['mean'],
            "f1_val": m['f1_score']['mean'],
            "confusion_matrix": cm,
        })

    # Process Tier 3
    if t3_data:
        m = t3_data.get("metrics", {})
        cm = t3_data.get("confusion_matrix", {})
        summary_records.append({
            "tier": "Tier 3: Zero-Shot Transfer",
            "training_source": "FallAllD (14 Subjects)",
            "evaluation_target": "UMAFall (19 Unseen Subjects)",
            "windows_count": t3_data.get("test_windows_count", 7456),
            "subjects_count": 19,
            "sampling_rate": f"{t3_data.get('sampling_rate_hz', 50)} Hz",
            "accuracy": f"{m.get('accuracy', 0)*100:.2f}%",
            "sensitivity": f"{m.get('sensitivity', 0)*100:.2f}%",
            "specificity": f"{m.get('specificity', 0)*100:.2f}%",
            "precision": f"{m.get('precision', 0)*100:.2f}%",
            "f1_score": f"{m.get('f1_score', 0)*100:.2f}%",
            "accuracy_val": m.get('accuracy', 0),
            "sensitivity_val": m.get('sensitivity', 0),
            "specificity_val": m.get('specificity', 0),
            "precision_val": m.get('precision', 0),
            "f1_val": m.get('f1_score', 0),
            "confusion_matrix": cm,
        })

    # Save summary JSON
    summary_path = os.path.join(OUTPUTS_DIR, "model_benchmarks_summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary_records, f, indent=2)
    print(f"Saved benchmark summary -> {summary_path}\n")

    # Print Table
    print("=" * 105)
    print(f"{'ALTiLINK 3-TIER ML BENCHMARK COMPARATIVE SUMMARY':^105}")
    print("=" * 105)
    print(f"{'Tier / Architecture':<34} | {'Cohort / Windows':<22} | {'Accuracy':<14} | {'Sensitivity':<14} | {'Specificity':<14} | {'F1-Score':<10}")
    print("-" * 105)

    for r in summary_records:
        cohort_str = f"{r['subjects_count']} sub / {r['windows_count']} wins"
        print(f"{r['tier']:<34} | {cohort_str:<22} | {r['accuracy']:<14} | {r['sensitivity']:<14} | {r['specificity']:<14} | {r['f1_score']:<10}")

    print("=" * 105)


if __name__ == "__main__":
    main()
