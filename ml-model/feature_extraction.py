#!/usr/bin/env python3
"""
AltiLink Fall Detection ML Subsystem - Feature Extraction
==========================================================
Implements digital signal processing (DSP), sliding window segmentation,
time-domain statistical extraction, and FFT frequency-domain power spectrum features.

Default Window Configuration:
  - Sampling Frequency (fs) : 200 Hz
  - Window Duration (T)     : 2.56 seconds (512 samples, optimal power-of-2 for FFT)
  - Overlap Ratio           : 50% (256 samples step size)
  - Boundary Constraint     : Windows strictly bounded per trial recording (no cross-subject leakage)
"""

import numpy as np
import pandas as pd
from scipy import signal, stats

# Default parameters
DEFAULT_SAMPLING_RATE_HZ = 200
DEFAULT_WINDOW_SEC = 2.56
DEFAULT_OVERLAP_RATIO = 0.5


def compute_zero_crossing_rate(sig):
    """
    Computes zero crossing rate of a 1D signal relative to its mean.
    """
    centered = sig - np.mean(sig)
    zero_crossings = np.sum(np.diff(np.signbit(centered)) != 0)
    return float(zero_crossings) / float(len(sig))


def compute_fft_features(sig, fs=DEFAULT_SAMPLING_RATE_HZ):
    """
    Computes frequency-domain features from a 1D signal window:
      1. Detrend signal (removes DC component)
      2. Compute one-sided power spectrum via rfft
      3. Identify dominant non-DC peak frequency
      4. Total spectral energy
      5. Low-frequency band energy (0.5 Hz - 3.0 Hz, human gait/ADL cadence)
      6. High-frequency impact band energy (3.0 Hz - 10.0 Hz, fall impact shock)

    Returns:
        dict with dominant_freq, spectral_energy, band_energy_low, band_energy_high
    """
    n = len(sig)
    if n < 4:
        return {
            "dominant_freq": 0.0,
            "spectral_energy": 0.0,
            "band_energy_low": 0.0,
            "band_energy_high": 0.0,
        }

    # 1. Detrend signal to remove DC bias
    detrended = signal.detrend(sig, type="constant")

    # 2. Compute one-sided FFT
    fft_vals = np.fft.rfft(detrended)
    freqs = np.fft.rfftfreq(n, d=1.0 / fs)
    psd = (np.abs(fft_vals) ** 2) / n

    # 3. Dominant frequency (exclude 0 Hz DC index)
    if len(psd) > 1:
        dominant_idx = np.argmax(psd[1:]) + 1
        dominant_freq = float(freqs[dominant_idx])
    else:
        dominant_freq = 0.0

    # 4. Total spectral energy
    total_energy = float(np.sum(psd))

    # 5. Low-frequency band (0.5 Hz - 3.0 Hz)
    low_mask = (freqs >= 0.5) & (freqs <= 3.0)
    band_energy_low = float(np.sum(psd[low_mask])) if np.any(low_mask) else 0.0

    # 6. High-frequency impact band (3.0 Hz - 10.0 Hz)
    high_mask = (freqs >= 3.0) & (freqs <= 10.0)
    band_energy_high = float(np.sum(psd[high_mask])) if np.any(high_mask) else 0.0

    return {
        "dominant_freq": dominant_freq,
        "spectral_energy": total_energy,
        "band_energy_low": band_energy_low,
        "band_energy_high": band_energy_high,
    }


def extract_features_from_window(window_df, fs=DEFAULT_SAMPLING_RATE_HZ):
    """
    Extracts orientation-invariant time-domain, two-phase impact/rest stillness,
    and frequency-domain features from a single window DataFrame.

    Parameters:
        window_df: pandas.DataFrame containing sensor columns:
                   acc_x, acc_y, acc_z, acc_mag, gyro_x, gyro_y, gyro_z, gyro_mag
        fs: Sampling frequency in Hz

    Returns:
        dict of engineered feature values (strictly orientation-invariant)
    """
    amag = window_df["acc_mag"].values
    gmag = window_df["gyro_mag"].values

    n = len(amag)
    dt = 1.0 / fs

    # 1. Global 3D Accelerometer Magnitude Features
    mean_amag = float(np.mean(amag))
    std_amag = float(np.std(amag))
    var_amag = float(np.var(amag))
    min_amag = float(np.min(amag))
    max_amag = float(np.max(amag))
    range_amag = max_amag - min_amag
    rms_amag = float(np.sqrt(np.mean(amag**2)))
    zcr_amag = compute_zero_crossing_rate(amag)

    kurt_amag = float(stats.kurtosis(amag)) if n > 3 else 0.0
    skew_amag = float(stats.skew(amag)) if n > 3 else 0.0

    # 2. Global 3D Gyroscope Magnitude Features
    mean_gmag = float(np.mean(gmag))
    std_gmag = float(np.std(gmag))
    min_gmag = float(np.min(gmag))
    max_gmag = float(np.max(gmag))
    range_gmag = max_gmag - min_gmag
    rms_gmag = float(np.sqrt(np.mean(gmag**2)))

    kurt_gmag = float(stats.kurtosis(gmag)) if n > 3 else 0.0
    skew_gmag = float(stats.skew(gmag)) if n > 3 else 0.0

    # 3. Kinematic Jerk (Derivative of 3D Accel Magnitude)
    jerk = np.diff(amag) / dt
    max_jerk = float(np.max(np.abs(jerk))) if len(jerk) > 0 else 0.0
    mean_jerk = float(np.mean(np.abs(jerk))) if len(jerk) > 0 else 0.0
    std_jerk = float(np.std(jerk)) if len(jerk) > 0 else 0.0

    # 4. Two-Phase Impact vs. Post-Impact Inactivity Segmentation
    peak_idx = int(np.argmax(amag))
    impact_half_samples = max(2, int(0.4 * fs))  # 0.4s around peak

    i_start = max(0, peak_idx - impact_half_samples)
    i_end = min(n, peak_idx + impact_half_samples)

    impact_amag = amag[i_start:i_end] if i_end > i_start else amag
    impact_gmag = gmag[i_start:i_end] if i_end > i_start else gmag

    impact_peak_acc = float(np.max(impact_amag))
    impact_peak_gyro = float(np.max(impact_gmag))
    impact_rms_acc = float(np.sqrt(np.mean(impact_amag**2)))
    impact_rms_gyro = float(np.sqrt(np.mean(impact_gmag**2)))
    impact_energy = float(np.sum(impact_amag**2))

    # Post-impact rest phase (tail of the window following impact shock)
    post_start = min(n - 1, peak_idx + int(0.3 * fs))
    if n - post_start < int(0.7 * fs):
        post_start = max(0, n - int(1.0 * fs))

    post_amag = amag[post_start:] if len(amag[post_start:]) > 2 else amag[-int(0.7 * fs):]
    post_gmag = gmag[post_start:] if len(gmag[post_start:]) > 2 else gmag[-int(0.7 * fs):]

    post_mean_acc = float(np.mean(post_amag))
    post_std_acc = float(np.std(post_amag))
    post_var_acc = float(np.var(post_amag))
    post_mean_gyro = float(np.mean(post_gmag))
    post_std_gyro = float(np.std(post_gmag))
    post_max_gyro = float(np.max(post_gmag))

    # Stillness Discrimination Ratios (High for Real Falls, Low for Active ADLs)
    stillness_acc_ratio = float(impact_peak_acc / (post_std_acc + 0.1))
    stillness_gyro_ratio = float(impact_peak_gyro / (post_mean_gyro + 0.1))

    # 5. Frequency-Domain Features (FFT on 3D Magnitudes)
    fft_acc = compute_fft_features(amag, fs=fs)
    fft_gyro = compute_fft_features(gmag, fs=fs)

    features = {
        # Accel 3D magnitude
        "mean_amag": mean_amag,
        "std_amag": std_amag,
        "var_amag": var_amag,
        "min_amag": min_amag,
        "max_amag": max_amag,
        "range_amag": range_amag,
        "rms_amag": rms_amag,
        "zcr_amag": zcr_amag,
        "kurt_amag": kurt_amag,
        "skew_amag": skew_amag,
        # Gyro 3D magnitude
        "mean_gmag": mean_gmag,
        "std_gmag": std_gmag,
        "min_gmag": min_gmag,
        "max_gmag": max_gmag,
        "range_gmag": range_gmag,
        "rms_gmag": rms_gmag,
        "kurt_gmag": kurt_gmag,
        "skew_gmag": skew_gmag,
        # Jerk features
        "max_jerk": max_jerk,
        "mean_jerk": mean_jerk,
        "std_jerk": std_jerk,
        # Two-Phase Impact Phase
        "impact_peak_acc": impact_peak_acc,
        "impact_peak_gyro": impact_peak_gyro,
        "impact_rms_acc": impact_rms_acc,
        "impact_rms_gyro": impact_rms_gyro,
        "impact_energy": impact_energy,
        # Two-Phase Post-Impact Rest Phase
        "post_mean_acc": post_mean_acc,
        "post_std_acc": post_std_acc,
        "post_var_acc": post_var_acc,
        "post_mean_gyro": post_mean_gyro,
        "post_std_gyro": post_std_gyro,
        "post_max_gyro": post_max_gyro,
        "stillness_acc_ratio": stillness_acc_ratio,
        "stillness_gyro_ratio": stillness_gyro_ratio,
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
    """
    Segments a single trial DataFrame into overlapping sliding windows and extracts features.
    
    CRITICAL: Never crosses trial or subject boundaries.

    Returns:
        tuple: (features_list, raw_windows_list)
          - features_list: list of dicts with extracted features + metadata
          - raw_windows_list: list of dicts with raw slice DataFrames (used for live demo)
    """
    window_samples = int(round(window_sec * fs))
    step_samples = int(round(window_samples * (1.0 - overlap_ratio)))
    total_samples = len(df_trial)

    if total_samples < window_samples:
        # Pad or use single window if recording is short
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
    """
    Builds the complete feature matrix and held-out window bank from a list of trial DataFrames.

    Returns:
        tuple: (df_features, all_raw_windows)
    """
    all_features = []
    all_raw_windows = []

    for i, trial_df in enumerate(trials_list):
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
        print(f"Class Distribution      :")
        vc = df_features["label"].value_counts()
        print(f"  - ADL Windows (0)     : {vc.get(0, 0)} ({vc.get(0, 0)*100/len(df_features):.1f}%)")
        print(f"  - Fall Windows (1)    : {vc.get(1, 0)} ({vc.get(1, 0)*100/len(df_features):.1f}%)")
        print(f"Unique Subjects in Windows: {df_features['subject_id'].nunique()}")
        print("==================================================")

    # Check for NaN / Inf values
    feat_cols = get_feature_names(df_features)
    has_nan = df_features[feat_cols].isna().any().any()
    has_inf = np.isinf(df_features[feat_cols].values).any()
    if has_nan or has_inf:
        raise ValueError(f"Feature matrix contains invalid values! NaN: {has_nan}, Inf: {has_inf}")

    return df_features, all_raw_windows


def get_feature_names(df_features):
    """
    Returns only the numerical feature column names (excluding metadata).
    """
    metadata_cols = {
        "subject_id", "subject_type", "activity_code", "trial_code",
        "window_idx", "start_sample", "end_sample", "label"
    }
    return [c for c in df_features.columns if c not in metadata_cols]


if __name__ == "__main__":
    from data_loader import load_all_sisfall_data, DEFAULT_DATA_DIR

    print("Testing feature extraction pipeline on a subset of SisFall recordings...")
    trials = load_all_sisfall_data(data_dir=DEFAULT_DATA_DIR, max_files=20, verbose=True)
    df_feat, raw_wins = build_feature_dataset(trials, verbose=True)

    print("\nFeature Matrix Sample Columns:")
    feat_cols = get_feature_names(df_feat)
    print(f"Total Features: {len(feat_cols)}")
    print(f"Columns: {feat_cols[:10]} ...")
    print("\nSample Feature Row (First Window):")
    for k in feat_cols[:8]:
        print(f"  {k:22s}: {df_feat[k].iloc[0]:.4f}")
    print("\nFeature extraction verification successful!")
