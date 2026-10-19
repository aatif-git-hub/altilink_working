#!/usr/bin/env python3
"""
AltiLink Fall Detection ML Subsystem - Feature Extraction (Upgraded)
===================================================================
DSP feature extraction enhanced with biomechanical kinematics:
  - Accelerometer and Gyroscope time-domain metrics
  - Jerk (Derivative of acceleration / impact shock rate)
  - Posture / Tilt Angle & Orientation Change (Initial vs. Final posture)
  - Statistical Peak Shape Moments (Kurtosis & Skewness)
  - FFT Frequency-Domain Band Energies
"""

import numpy as np
import pandas as pd
from scipy import signal, stats

DEFAULT_SAMPLING_RATE_HZ = 200
DEFAULT_WINDOW_SEC = 2.56
DEFAULT_OVERLAP_RATIO = 0.5


def compute_zero_crossing_rate(sig):
    centered = sig - np.mean(sig)
    zero_crossings = np.sum(np.diff(np.signbit(centered)) != 0)
    return float(zero_crossings) / float(len(sig))


def compute_fft_features(sig, fs=DEFAULT_SAMPLING_RATE_HZ):
    n = len(sig)
    if n < 4:
        return {
            "dominant_freq": 0.0,
            "spectral_energy": 0.0,
            "band_energy_low": 0.0,
            "band_energy_high": 0.0,
        }

    detrended = signal.detrend(sig, type="constant")
    fft_vals = np.fft.rfft(detrended)
    freqs = np.fft.rfftfreq(n, d=1.0 / fs)
    psd = (np.abs(fft_vals) ** 2) / n

    if len(psd) > 1:
        dominant_idx = np.argmax(psd[1:]) + 1
        dominant_freq = float(freqs[dominant_idx])
    else:
        dominant_freq = 0.0

    total_energy = float(np.sum(psd))

    low_mask = (freqs >= 0.5) & (freqs <= 3.0)
    band_energy_low = float(np.sum(psd[low_mask])) if np.any(low_mask) else 0.0

    high_mask = (freqs >= 3.0) & (freqs <= 10.0)
    band_energy_high = float(np.sum(psd[high_mask])) if np.any(high_mask) else 0.0

    return {
        "dominant_freq": dominant_freq,
        "spectral_energy": total_energy,
        "band_energy_low": band_energy_low,
        "band_energy_high": band_energy_high,
    }


def extract_features_from_window(window_df, fs=DEFAULT_SAMPLING_RATE_HZ):
    ax = window_df["acc_x"].values
    ay = window_df["acc_y"].values
    az = window_df["acc_z"].values
    amag = window_df["acc_mag"].values

    gx = window_df["gyro_x"].values
    gy = window_df["gyro_y"].values
    gz = window_df["gyro_z"].values
    gmag = window_df["gyro_mag"].values

    n = len(amag)

    # 1. Accelerometer Magnitude Statistics
    mean_amag = float(np.mean(amag))
    std_amag = float(np.std(amag))
    var_amag = float(np.var(amag))
    min_amag = float(np.min(amag))
    max_amag = float(np.max(amag))
    range_amag = max_amag - min_amag
    rms_amag = float(np.sqrt(np.mean(amag**2)))
    zcr_amag = compute_zero_crossing_rate(amag)

    # Signal Magnitude Area (SMA)
    sma_acc = float(np.sum(np.abs(ax) + np.abs(ay) + np.abs(az)) / n)

    # Peak Shape Moments (Kurtosis & Skewness)
    kurtosis_amag = float(stats.kurtosis(amag)) if n > 3 else 0.0
    skewness_amag = float(stats.skew(amag)) if n > 3 else 0.0

    # 2. Jerk (Derivative of acceleration: da/dt)
    dt = 1.0 / fs
    jerk = np.diff(amag) / dt
    max_jerk = float(np.max(np.abs(jerk))) if len(jerk) > 0 else 0.0
    mean_jerk = float(np.mean(np.abs(jerk))) if len(jerk) > 0 else 0.0
    std_jerk = float(np.std(jerk)) if len(jerk) > 0 else 0.0

    # 3. Posture & Tilt Angle
    # Tilt angle relative to vertical Z-axis in degrees
    safe_amag = np.where(amag == 0, 1e-6, amag)
    tilt_angles = np.arccos(np.clip(az / safe_amag, -1.0, 1.0)) * (180.0 / np.pi)
    
    mean_tilt = float(np.mean(tilt_angles))
    max_tilt = float(np.max(tilt_angles))
    
    # Pre-fall vs Post-fall posture difference (first 0.5s vs last 0.5s)
    edge_samples = max(1, int(0.5 * fs))
    tilt_initial = float(np.mean(tilt_angles[:edge_samples]))
    tilt_final = float(np.mean(tilt_angles[-edge_samples:]))
    tilt_diff = abs(tilt_final - tilt_initial)

    # 4. Axis-Level Accelerometer Statistics
    mean_ax, std_ax, min_ax, max_ax = float(np.mean(ax)), float(np.std(ax)), float(np.min(ax)), float(np.max(ax))
    mean_ay, std_ay, min_ay, max_ay = float(np.mean(ay)), float(np.std(ay)), float(np.min(ay)), float(np.max(ay))
    mean_az, std_az, min_az, max_az = float(np.mean(az)), float(np.std(az)), float(np.min(az)), float(np.max(az))

    # 5. Gyroscope Magnitude & Axis Statistics
    mean_gmag = float(np.mean(gmag))
    std_gmag = float(np.std(gmag))
    max_gmag = float(np.max(gmag))
    rms_gmag = float(np.sqrt(np.mean(gmag**2)))
    sma_gyro = float(np.sum(np.abs(gx) + np.abs(gy) + np.abs(gz)) / n)

    mean_gx, std_gx, max_gx = float(np.mean(gx)), float(np.std(gx)), float(np.max(gx))
    mean_gy, std_gy, max_gy = float(np.mean(gy)), float(np.std(gy)), float(np.max(gy))
    mean_gz, std_gz, max_gz = float(np.mean(gz)), float(np.std(gz)), float(np.max(gz))

    # 6. Frequency-Domain Features (FFT)
    fft_acc = compute_fft_features(amag, fs=fs)
    fft_gyro = compute_fft_features(gmag, fs=fs)

    features = {
        # Accel magnitude stats
        "mean_amag": mean_amag,
        "std_amag": std_amag,
        "var_amag": var_amag,
        "min_amag": min_amag,
        "max_amag": max_amag,
        "range_amag": range_amag,
        "rms_amag": rms_amag,
        "zcr_amag": zcr_amag,
        "sma_acc": sma_acc,
        "kurtosis_amag": kurtosis_amag,
        "skewness_amag": skewness_amag,
        # Jerk features
        "max_jerk": max_jerk,
        "mean_jerk": mean_jerk,
        "std_jerk": std_jerk,
        # Posture & Tilt features
        "mean_tilt": mean_tilt,
        "max_tilt": max_tilt,
        "tilt_initial": tilt_initial,
        "tilt_final": tilt_final,
        "tilt_diff": tilt_diff,
        # Axis-level accel
        "mean_ax": mean_ax,
        "std_ax": std_ax,
        "min_ax": min_ax,
        "max_ax": max_ax,
        "mean_ay": mean_ay,
        "std_ay": std_ay,
        "min_ay": min_ay,
        "max_ay": max_ay,
        "mean_az": mean_az,
        "std_az": std_az,
        "min_az": min_az,
        "max_az": max_az,
        # Gyro magnitude & axis
        "mean_gmag": mean_gmag,
        "std_gmag": std_gmag,
        "max_gmag": max_gmag,
        "rms_gmag": rms_gmag,
        "sma_gyro": sma_gyro,
        "mean_gx": mean_gx,
        "std_gx": std_gx,
        "max_gx": max_gx,
        "mean_gy": mean_gy,
        "std_gy": std_gy,
        "max_gy": max_gy,
        "mean_gz": mean_gz,
        "std_gz": std_gz,
        "max_gz": max_gz,
        # FFT features
        "dominant_freq_amag": fft_acc["dominant_freq"],
        "spectral_energy_amag": fft_acc["spectral_energy"],
        "band_energy_low_amag": fft_acc["band_energy_low"],
        "band_energy_high_amag": fft_acc["band_energy_high"],
        "dominant_freq_gmag": fft_gyro["dominant_freq"],
        "spectral_energy_gmag": fft_gyro["spectral_energy"],
        "band_energy_low_gmag": fft_gyro["band_energy_low"],
        "band_energy_high_gmag": fft_gyro["band_energy_high"],
    }

    return features


def extract_windows_from_trial(df_trial, window_sec=DEFAULT_WINDOW_SEC, overlap_ratio=DEFAULT_OVERLAP_RATIO, fs=DEFAULT_SAMPLING_RATE_HZ):
    window_samples = int(round(window_sec * fs))
    step_samples = int(round(window_samples * (1.0 - overlap_ratio)))
    total_samples = len(df_trial)

    if total_samples < window_samples:
        return [], []

    features_list = []
    raw_windows_list = []

    subject_id = df_trial["subject_id"].iloc[0]
    subject_type = df_trial["subject_type"].iloc[0]
    activity_code = df_trial["activity_code"].iloc[0]
    trial_code = df_trial["trial_code"].iloc[0]
    label = int(df_trial["label"].iloc[0])

    start_idx = 0
    window_idx = 0
    while start_idx + window_samples <= total_samples:
        end_idx = start_idx + window_samples
        w_df = df_trial.iloc[start_idx:end_idx].reset_index(drop=True)

        feat = extract_features_from_window(w_df, fs=fs)
        feat["subject_id"] = subject_id
        feat["subject_type"] = subject_type
        feat["activity_code"] = activity_code
        feat["trial_code"] = trial_code
        feat["window_idx"] = window_idx
        feat["start_sample"] = start_idx
        feat["end_sample"] = end_idx
        feat["label"] = label

        features_list.append(feat)

        raw_windows_list.append({
            "subject_id": subject_id,
            "subject_type": subject_type,
            "activity_code": activity_code,
            "trial_code": trial_code,
            "window_idx": window_idx,
            "label": label,
            "raw_df": w_df,
        })

        window_idx += 1
        start_idx += step_samples

    return features_list, raw_windows_list


def build_feature_dataset(trials_list, window_sec=DEFAULT_WINDOW_SEC, overlap_ratio=DEFAULT_OVERLAP_RATIO, fs=DEFAULT_SAMPLING_RATE_HZ, verbose=True):
    all_features = []
    all_raw_windows = []

    for trial_df in trials_list:
        feats, raw_wins = extract_windows_from_trial(
            trial_df, window_sec=window_sec, overlap_ratio=overlap_ratio, fs=fs
        )
        all_features.extend(feats)
        all_raw_windows.extend(raw_wins)

    df_features = pd.DataFrame(all_features)

    if verbose:
        print("==================================================")
        print("ALTiLINK FEATURE EXTRACTION SUMMARY")
        print("==================================================")
        print(f"Total Extracted Windows : {len(df_features)}")
        print(f"Feature Columns Count   : {len(get_feature_names(df_features))}")
        vc = df_features["label"].value_counts()
        print(f"  - ADL Windows (0)     : {vc.get(0, 0)} ({vc.get(0, 0)*100/len(df_features):.1f}%)")
        print(f"  - Fall Windows (1)    : {vc.get(1, 0)} ({vc.get(1, 0)*100/len(df_features):.1f}%)")
        print(f"Unique Subjects in Windows: {df_features['subject_id'].nunique()}")
        print("==================================================")

    feat_cols = get_feature_names(df_features)
    has_nan = df_features[feat_cols].isna().any().any()
    has_inf = np.isinf(df_features[feat_cols].values).any()
    if has_nan or has_inf:
        raise ValueError(f"Feature matrix contains invalid values! NaN: {has_nan}, Inf: {has_inf}")

    return df_features, all_raw_windows


def get_feature_names(df_features):
    metadata_cols = {
        "subject_id", "subject_type", "activity_code", "trial_code",
        "window_idx", "start_sample", "end_sample", "label"
    }
    return [c for c in df_features.columns if c not in metadata_cols]
