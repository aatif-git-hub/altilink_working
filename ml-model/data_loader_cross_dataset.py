#!/usr/bin/env python3
"""
AltiLink Fall Detection ML Subsystem - Cross-Dataset Data Loader
================================================================
Ingests, calibrates, resamples, and harmonizes:
  1. FallAllD Dataset (Training) -> Resampled to 50 Hz, Accel (m/s^2), Gyro (rad/s)
  2. UMAFall Dataset (Testing)   -> Resampled to 50 Hz, Accel (m/s^2), Gyro (rad/s)
"""

import os
import re
import io
import glob
import numpy as np
import pandas as pd
from scipy import signal
from scipy.interpolate import interp1d

GRAVITY_MS2 = 9.80665
TARGET_FS_HZ = 50

# FallAllD LSM6DSL Scale Factors
FALLALLD_ACC_SCALE = (1.0 / 4096.0) * GRAVITY_MS2      # 4096 LSB/g -> m/s^2
FALLALLD_GYR_SCALE = (1.0 / 16.4) * (np.pi / 180.0)    # 16.4 LSB/dps -> rad/s
FALLALLD_RAW_FS = 238.0

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_FALLALLD_DIR = os.path.join(BASE_DIR, "data", "fallalld")
DEFAULT_UMAFALL_DIR = os.path.join(BASE_DIR, "data", "umafall")


def load_single_fallalld_trial(a_filepath, g_filepath, target_fs=TARGET_FS_HZ):
    """
    Loads synchronized Accelerometer (_A.dat) and Gyroscope (_G.dat) from FallAllD.
    Resamples from 238 Hz to target_fs (50 Hz).
    """
    basename = os.path.basename(a_filepath)
    m = re.match(r"S(\d+)_D(\d+)_A(\d+)_T(\d+)_A\.dat", basename)
    if not m:
        raise ValueError(f"Invalid FallAllD filename: {basename}")

    subj_num = int(m.group(1))
    device_num = int(m.group(2))
    act_num = int(m.group(3))
    trial_num = int(m.group(4))

    subject_id = f"FAD_S{subj_num:02d}"
    activity_code = f"A{act_num:03d}"
    trial_code = f"T{trial_num:02d}"
    is_fall = 1 if act_num >= 101 else 0

    a_raw = np.loadtxt(a_filepath, delimiter=",", dtype=np.float64)
    g_raw = np.loadtxt(g_filepath, delimiter=",", dtype=np.float64)

    min_len = min(len(a_raw), len(g_raw))
    if min_len < 100:
        raise ValueError(f"Trial too short ({min_len} rows) in {basename}")

    a_raw = a_raw[:min_len]
    g_raw = g_raw[:min_len]

    # Convert physical units
    ax_ms2 = a_raw[:, 0] * FALLALLD_ACC_SCALE
    ay_ms2 = a_raw[:, 1] * FALLALLD_ACC_SCALE
    az_ms2 = a_raw[:, 2] * FALLALLD_ACC_SCALE

    gx_rads = g_raw[:, 0] * FALLALLD_GYR_SCALE
    gy_rads = g_raw[:, 1] * FALLALLD_GYR_SCALE
    gz_rads = g_raw[:, 2] * FALLALLD_GYR_SCALE

    # Resample 238 Hz -> 50 Hz
    num_target_samples = max(4, int(round(min_len * (target_fs / FALLALLD_RAW_FS))))

    ax_res = signal.resample(ax_ms2, num_target_samples)
    ay_res = signal.resample(ay_ms2, num_target_samples)
    az_res = signal.resample(az_ms2, num_target_samples)

    gx_res = signal.resample(gx_rads, num_target_samples)
    gy_res = signal.resample(gy_rads, num_target_samples)
    gz_res = signal.resample(gz_rads, num_target_samples)

    acc_mag = np.sqrt(ax_res**2 + ay_res**2 + az_res**2)
    gyro_mag = np.sqrt(gx_res**2 + gy_res**2 + gz_res**2)

    df = pd.DataFrame({
        "sample_idx": np.arange(num_target_samples, dtype=np.int32),
        "subject_id": subject_id,
        "subject_type": "YOUNG",
        "activity_code": activity_code,
        "trial_code": trial_code,
        "label": is_fall,
        "acc_x": ax_res,
        "acc_y": ay_res,
        "acc_z": az_res,
        "acc_mag": acc_mag,
        "gyro_x": gx_res,
        "gyro_y": gy_res,
        "gyro_z": gz_res,
        "gyro_mag": gyro_mag,
    })
    return df


def load_fallalld_dataset(data_dir=DEFAULT_FALLALLD_DIR, device="D1", target_fs=TARGET_FS_HZ, max_trials=None, verbose=True):
    """
    Loads and resamples FallAllD trials for a specific device (default D1: Wrist).
    """
    a_files = sorted(glob.glob(os.path.join(data_dir, f"*_{device}_*_A.dat")))
    if not a_files:
        a_files = sorted(glob.glob(os.path.join(data_dir, "**", f"*_{device}_*_A.dat"), recursive=True))

    if verbose:
        print(f"Found {len(a_files)} FallAllD {device} trials in {data_dir}")

    trials = []
    for a_path in a_files:
        g_path = a_path[:-6] + "_G.dat"
        if os.path.exists(g_path):
            try:
                df = load_single_fallalld_trial(a_path, g_path, target_fs=target_fs)
                trials.append(df)
                if max_trials and len(trials) >= max_trials:
                    break
            except Exception:
                continue

    if verbose:
        falls = sum(1 for t in trials if t["label"].iloc[0] == 1)
        adls = len(trials) - falls
        print(f"Successfully parsed {len(trials)} FallAllD trials ({falls} Falls, {adls} ADLs) resampled to {target_fs} Hz.")

    return trials


def load_single_umafall_file(csv_filepath, target_fs=TARGET_FS_HZ):
    """
    Parses a single UMAFall CSV file, extracts Wrist (or Waist) sensor, and resamples to 50 Hz.
    """
    basename = os.path.basename(csv_filepath)
    is_fall = 1 if "_FALL_" in basename.upper() else 0

    # Extract subject and activity name from filename
    # e.g., UMAFall_Subject_01_ADL_Aplausing_1_...
    parts = basename.replace(".csv", "").split("_")
    subj_id = "UMA_S01"
    act_code = "ADL"
    trial_code = "T01"

    for i, p in enumerate(parts):
        if p.upper() == "SUBJECT" and i + 1 < len(parts):
            subj_id = f"UMA_S{int(parts[i+1]):02d}"
        elif p.upper() in ["ADL", "FALL"] and i + 1 < len(parts):
            act_code = parts[i+1]
        elif p.isdigit() and i > 3:
            trial_code = f"T{int(p):02d}"

    with open(csv_filepath, "r", encoding="utf-8", errors="ignore") as f:
        lines = [l.strip().rstrip(";") for l in f if not l.startswith("%") and l.strip()]

    if not lines:
        raise ValueError(f"No data lines in {basename}")

    df_raw = pd.read_csv(io.StringIO("\n".join(lines)), sep=";", header=None)
    df_raw.columns = ["timestamp", "sample_no", "x", "y", "z", "sensor_type", "sensor_id"]

    # Prefer Wrist (Sensor ID 3); fallback to Waist (Sensor ID 2) or Chest (Sensor ID 1)
    chosen_sid = None
    for sid in [3, 2, 1, 0]:
        has_acc = ((df_raw["sensor_id"] == sid) & (df_raw["sensor_type"] == 0)).sum() > 20
        has_gyr = ((df_raw["sensor_id"] == sid) & (df_raw["sensor_type"] == 1)).sum() > 20
        if has_acc and has_gyr:
            chosen_sid = sid
            break
        elif has_acc and chosen_sid is None:
            chosen_sid = sid

    if chosen_sid is None:
        raise ValueError(f"No valid sensor data in {basename}")

    df_acc = df_raw[(df_raw["sensor_id"] == chosen_sid) & (df_raw["sensor_type"] == 0)].drop_duplicates("timestamp").sort_values("timestamp")
    df_gyr = df_raw[(df_raw["sensor_id"] == chosen_sid) & (df_raw["sensor_type"] == 1)].drop_duplicates("timestamp").sort_values("timestamp")

    if len(df_acc) < 10:
        raise ValueError(f"Insufficient accelerometer points ({len(df_acc)}) in {basename}")

    t_acc = df_acc["timestamp"].values
    if len(df_gyr) >= 10:
        t_gyr = df_gyr["timestamp"].values
        t_start = max(t_acc[0], t_gyr[0])
        t_end = min(t_acc[-1], t_gyr[-1])
    else:
        t_start, t_end = t_acc[0], t_acc[-1]

    if t_end - t_start < 1000:
        raise ValueError(f"Duration too short ({t_end - t_start} ms) in {basename}")

    # Regular 50 Hz grid (20 ms interval)
    dt_ms = 1000.0 / target_fs
    t_grid = np.arange(t_start, t_end, dt_ms)
    if len(t_grid) < 10:
        raise ValueError(f"Grid too short ({len(t_grid)}) in {basename}")

    # Accelerometer in m/s^2 (UMAFall raw accelerometer is in g)
    ax_ms2 = interp1d(t_acc, df_acc["x"].values * GRAVITY_MS2, kind="linear", fill_value="extrapolate")(t_grid)
    ay_ms2 = interp1d(t_acc, df_acc["y"].values * GRAVITY_MS2, kind="linear", fill_value="extrapolate")(t_grid)
    az_ms2 = interp1d(t_acc, df_acc["z"].values * GRAVITY_MS2, kind="linear", fill_value="extrapolate")(t_grid)

    # Gyroscope in rad/s (UMAFall raw gyro is in deg/s)
    if len(df_gyr) >= 10:
        gx_rads = interp1d(t_gyr, df_gyr["x"].values * (np.pi / 180.0), kind="linear", fill_value="extrapolate")(t_grid)
        gy_rads = interp1d(t_gyr, df_gyr["y"].values * (np.pi / 180.0), kind="linear", fill_value="extrapolate")(t_grid)
        gz_rads = interp1d(t_gyr, df_gyr["z"].values * (np.pi / 180.0), kind="linear", fill_value="extrapolate")(t_grid)
    else:
        gx_rads = np.zeros_like(t_grid)
        gy_rads = np.zeros_like(t_grid)
        gz_rads = np.zeros_like(t_grid)

    acc_mag = np.sqrt(ax_ms2**2 + ay_ms2**2 + az_ms2**2)
    gyro_mag = np.sqrt(gx_rads**2 + gy_rads**2 + gz_rads**2)

    df_out = pd.DataFrame({
        "sample_idx": np.arange(len(t_grid), dtype=np.int32),
        "subject_id": subj_id,
        "subject_type": "YOUNG",
        "activity_code": act_code,
        "trial_code": trial_code,
        "label": is_fall,
        "acc_x": ax_ms2,
        "acc_y": ay_ms2,
        "acc_z": az_ms2,
        "acc_mag": acc_mag,
        "gyro_x": gx_rads,
        "gyro_y": gy_rads,
        "gyro_z": gz_rads,
        "gyro_mag": gyro_mag,
    })
    return df_out


def load_umafall_dataset(data_dir=DEFAULT_UMAFALL_DIR, target_fs=TARGET_FS_HZ, max_trials=None, verbose=True):
    """
    Loads and resamples UMAFall trials to target_fs (50 Hz).
    """
    csv_files = sorted(glob.glob(os.path.join(data_dir, "*.csv")))
    if not csv_files:
        csv_files = sorted(glob.glob(os.path.join(data_dir, "**", "*.csv"), recursive=True))

    if verbose:
        print(f"Found {len(csv_files)} UMAFall files in {data_dir}")

    trials = []
    for path in csv_files:
        try:
            df = load_single_umafall_file(path, target_fs=target_fs)
            trials.append(df)
            if max_trials and len(trials) >= max_trials:
                break
        except Exception:
            continue

    if verbose:
        falls = sum(1 for t in trials if t["label"].iloc[0] == 1)
        adls = len(trials) - falls
        print(f"Successfully parsed {len(trials)} UMAFall trials ({falls} Falls, {adls} ADLs) resampled to {target_fs} Hz.")

    return trials


# SisFall Scale Factors
SISFALL_ACC_SCALE = (32.0 / 8192.0) * GRAVITY_MS2      # ADXL345: +/-16g -> m/s^2
SISFALL_GYR_SCALE = (4000.0 / 65536.0) * (np.pi / 180.0) # ITG3200: +/-2000 dps -> rad/s
DEFAULT_SISFALL_DIR = os.path.join(BASE_DIR, "data", "sisfall")


def load_single_sisfall_trial(filepath, target_fs=TARGET_FS_HZ):
    """
    Reads a single SisFall text recording, scales ADXL345 and ITG3200 to physical units,
    and resamples from 200 Hz to target_fs (50 Hz).
    """
    basename = os.path.basename(filepath)
    m = re.match(r"^([DF]\d{1,2})_([S][AE]\d{1,2})_([R]\d{1,2})", basename, re.IGNORECASE)
    if not m:
        raise ValueError(f"Invalid SisFall filename: {basename}")

    act_code = m.group(1).upper()
    subj_code = m.group(2).upper()
    trial_code = m.group(3).upper()

    subject_id = f"SIS_{subj_code}"
    subject_type = "ELDERLY" if "SE" in subj_code else "YOUNG"
    is_fall = 1 if act_code.startswith("F") else 0

    rows = []
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line_str = line.strip().rstrip(";,").strip()
            if not line_str:
                continue
            parts = re.split(r"[,\s]+", line_str)
            if len(parts) >= 6:
                try:
                    rows.append([float(parts[i]) for i in range(6)])
                except ValueError:
                    continue

    if len(rows) < 50:
        raise ValueError(f"Recording too short ({len(rows)} samples) in {basename}")

    arr = np.array(rows, dtype=np.float64)

    # Convert units
    ax_ms2 = arr[:, 0] * SISFALL_ACC_SCALE
    ay_ms2 = arr[:, 1] * SISFALL_ACC_SCALE
    az_ms2 = arr[:, 2] * SISFALL_ACC_SCALE

    gx_rads = arr[:, 3] * SISFALL_GYR_SCALE
    gy_rads = arr[:, 4] * SISFALL_GYR_SCALE
    gz_rads = arr[:, 5] * SISFALL_GYR_SCALE

    # Resample 200 Hz -> 50 Hz
    num_target_samples = max(4, int(round(len(arr) * (target_fs / 200.0))))

    ax_res = signal.resample(ax_ms2, num_target_samples)
    ay_res = signal.resample(ay_ms2, num_target_samples)
    az_res = signal.resample(az_ms2, num_target_samples)

    gx_res = signal.resample(gx_rads, num_target_samples)
    gy_res = signal.resample(gy_rads, num_target_samples)
    gz_res = signal.resample(gz_rads, num_target_samples)

    acc_mag = np.sqrt(ax_res**2 + ay_res**2 + az_res**2)
    gyro_mag = np.sqrt(gx_res**2 + gy_res**2 + gz_res**2)

    df_out = pd.DataFrame({
        "sample_idx": np.arange(num_target_samples, dtype=np.int32),
        "subject_id": subject_id,
        "subject_type": subject_type,
        "activity_code": act_code,
        "trial_code": trial_code,
        "label": is_fall,
        "acc_x": ax_res,
        "acc_y": ay_res,
        "acc_z": az_res,
        "acc_mag": acc_mag,
        "gyro_x": gx_res,
        "gyro_y": gy_res,
        "gyro_z": gz_res,
        "gyro_mag": gyro_mag,
        "dataset_source": "SisFall",
    })
    return df_out


def load_sisfall_dataset(data_dir=DEFAULT_SISFALL_DIR, target_fs=TARGET_FS_HZ, max_trials=None, verbose=True):
    """
    Loads and resamples all SisFall recordings to 50 Hz.
    """
    files = sorted(glob.glob(os.path.join(data_dir, "*.txt")))
    if not files:
        files = sorted(glob.glob(os.path.join(data_dir, "**", "*.txt"), recursive=True))

    if verbose:
        print(f"Found {len(files)} SisFall files in {data_dir}")

    trials = []
    for path in files:
        try:
            df = load_single_sisfall_trial(path, target_fs=target_fs)
            trials.append(df)
            if max_trials and len(trials) >= max_trials:
                break
        except Exception:
            continue

    if verbose:
        falls = sum(1 for t in trials if t["label"].iloc[0] == 1)
        adls = len(trials) - falls
        subjs = len(set(t["subject_id"].iloc[0] for t in trials))
        print(f"Successfully parsed {len(trials)} SisFall trials ({falls} Falls, {adls} ADLs across {subjs} subjects) resampled to {target_fs} Hz.")

    return trials


def load_unified_multi_dataset(
    sisfall_dir=DEFAULT_SISFALL_DIR,
    fallalld_dir=DEFAULT_FALLALLD_DIR,
    umafall_dir=DEFAULT_UMAFALL_DIR,
    target_fs=TARGET_FS_HZ,
    verbose=True
):
    """
    Ingests and harmonizes all three datasets (SisFall, FallAllD, UMAFall)
    to a unified 50 Hz sampling rate and common kinematic coordinate space.

    Returns:
        list of pandas.DataFrame trials across all subjects.
    """
    if verbose:
        print("=================================================================")
        print("INGESTING & HARMONIZING MULTI-DATASET POOLED BANK (50 Hz)")
        print("=================================================================")

    # 1. SisFall
    sisfall_trials = load_sisfall_dataset(data_dir=sisfall_dir, target_fs=target_fs, verbose=verbose)

    # 2. FallAllD
    fallalld_trials = load_fallalld_dataset(data_dir=fallalld_dir, target_fs=target_fs, verbose=verbose)
    for t in fallalld_trials:
        t["dataset_source"] = "FallAllD"

    # 3. UMAFall
    umafall_trials = load_umafall_dataset(data_dir=umafall_dir, target_fs=target_fs, verbose=verbose)
    for t in umafall_trials:
        t["dataset_source"] = "UMAFall"

    all_trials = sisfall_trials + fallalld_trials + umafall_trials

    if verbose:
        total_falls = sum(1 for t in all_trials if t["label"].iloc[0] == 1)
        total_adls = len(all_trials) - total_falls
        unique_subjs = len(set(t["subject_id"].iloc[0] for t in all_trials))
        print("=================================================================")
        print(f"UNIFIED POOLED BANK TOTAL: {len(all_trials)} Trials")
        print(f"  - Unique Subjects : {unique_subjs} (SisFall: 38, FallAllD: 14, UMAFall: 19)")
        print(f"  - Class Breakdown : {total_falls} Falls ({(total_falls*100/len(all_trials)):.1f}%), {total_adls} ADLs ({(total_adls*100/len(all_trials)):.1f}%)")
        print("=================================================================\n")

    return all_trials
