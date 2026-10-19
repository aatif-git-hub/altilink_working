#!/usr/bin/env python3
"""
AltiLink Fall Detection ML Subsystem - Data Loader
===================================================
Module for downloading, validating, parsing, and converting raw SisFall IMU files.

Sensor Scale Factors (from official SisFall documentation):
  - ADXL345:  13-bit ADC, +/-16g range  -> Scale factor = 32 / 8192  = 0.00390625 g/LSB
  - ITG3200:  16-bit ADC, +/-2000 deg/s -> Scale factor = 4000 / 65536 = 0.06103515625 deg/s/LSB
  - MMA8451Q: 14-bit ADC, +/-8g range   -> Scale factor = 16 / 16384 = 0.0009765625 g/LSB

Gravity Constant: 1 g = 9.80665 m/s^2
Sampling Rate: 200 Hz
"""

import os
import sys
import glob
import re
import argparse
import zipfile
import urllib.request
import numpy as np
import pandas as pd

# Constants
SAMPLING_RATE_HZ = 200
GRAVITY_MS2 = 9.80665

# Calibration scale factors
ADXL345_SCALE_G = 32.0 / 8192.0          # 0.00390625 g/LSB
ITG3200_SCALE_DPS = 4000.0 / 65536.0     # ~0.061035 deg/s/LSB
ITG3200_SCALE_RADS = ITG3200_SCALE_DPS * (np.pi / 180.0)
MMA8451Q_SCALE_G = 16.0 / 16384.0        # 0.0009765625 g/LSB

DEFAULT_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "sisfall")
SISFALL_DOWNLOAD_URL = "https://huggingface.co/datasets/abys7315/Sisfall_Dataset/resolve/main/SisFall_dataset.zip"


def parse_sisfall_filename(filepath):
    """
    Extracts activity code, subject ID, trial, and binary label from a SisFall filename.
    Filename pattern: <Activity>_<Subject>_<Trial>.txt (e.g., D01_SA01_R01.txt, F05_SE03_R02.txt)

    Returns:
        dict: {
            "activity_code": str,  # e.g. 'D01', 'F05'
            "subject_id": str,     # e.g. 'SA01', 'SE03'
            "subject_type": str,   # 'YOUNG' (SA) or 'ELDERLY' (SE)
            "trial_code": str,     # e.g. 'R01'
            "is_fall": int         # 1 if Fall ('F..'), 0 if ADL ('D..')
        }
    """
    basename = os.path.basename(filepath)
    match = re.match(r"^([DF]\d{2})_([S][AE]\d{2})_([R]\d{2})\.txt$", basename, re.IGNORECASE)
    if not match:
        # Fallback regex for minor naming variations
        match = re.match(r"^([DF]\d{1,2})_([S][AE]\d{1,2})_([R]\d{1,2})", basename, re.IGNORECASE)
        if not match:
            raise ValueError(f"Filename does not match SisFall naming convention: {basename}")

    activity_code = match.group(1).upper()
    subject_id = match.group(2).upper()
    trial_code = match.group(3).upper()

    is_fall = 1 if activity_code.startswith("F") else 0
    subject_type = "ELDERLY" if "SE" in subject_id else "YOUNG"

    return {
        "activity_code": activity_code,
        "subject_id": subject_id,
        "subject_type": subject_type,
        "trial_code": trial_code,
        "is_fall": is_fall,
    }


def load_single_sisfall_file(filepath):
    """
    Reads a single SisFall text file and converts raw ADC integer counts to physical units.

    Returns:
        pandas.DataFrame with columns:
          - subject_id, activity_code, trial_code, label
          - acc_x, acc_y, acc_z (ADXL345 in m/s^2)
          - acc_mag (m/s^2)
          - gyro_x, gyro_y, gyro_z (ITG3200 in rad/s)
          - gyro_mag (rad/s)
          - acc2_x, acc2_y, acc2_z (MMA8451Q in m/s^2)
    """
    meta = parse_sisfall_filename(filepath)

    raw_data = []
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line_str = line.strip().rstrip(";,").strip()
            if not line_str:
                continue
            # Handle comma or whitespace delimited values
            parts = re.split(r"[,\s]+", line_str)
            if len(parts) >= 9:
                try:
                    row_vals = [float(p) for p in parts[:9]]
                    raw_data.append(row_vals)
                except ValueError:
                    continue

    if len(raw_data) == 0:
        raise ValueError(f"No valid sensor rows found in file: {filepath}")

    arr = np.array(raw_data, dtype=np.float64)

    # 1. ADXL345 Accelerometer (Columns 0, 1, 2) -> m/s^2
    acc_x = arr[:, 0] * ADXL345_SCALE_G * GRAVITY_MS2
    acc_y = arr[:, 1] * ADXL345_SCALE_G * GRAVITY_MS2
    acc_z = arr[:, 2] * ADXL345_SCALE_G * GRAVITY_MS2
    acc_mag = np.sqrt(acc_x**2 + acc_y**2 + acc_z**2)

    # 2. ITG3200 Gyroscope (Columns 3, 4, 5) -> rad/s
    gyro_x = arr[:, 3] * ITG3200_SCALE_RADS
    gyro_y = arr[:, 4] * ITG3200_SCALE_RADS
    gyro_z = arr[:, 5] * ITG3200_SCALE_RADS
    gyro_mag = np.sqrt(gyro_x**2 + gyro_y**2 + gyro_z**2)

    # 3. MMA8451Q Accelerometer (Columns 6, 7, 8) -> m/s^2
    acc2_x = arr[:, 6] * MMA8451Q_SCALE_G * GRAVITY_MS2
    acc2_y = arr[:, 7] * MMA8451Q_SCALE_G * GRAVITY_MS2
    acc2_z = arr[:, 8] * MMA8451Q_SCALE_G * GRAVITY_MS2

    n_samples = len(arr)
    df = pd.DataFrame({
        "sample_idx": np.arange(n_samples, dtype=np.int32),
        "subject_id": meta["subject_id"],
        "subject_type": meta["subject_type"],
        "activity_code": meta["activity_code"],
        "trial_code": meta["trial_code"],
        "label": meta["is_fall"],
        "acc_x": acc_x,
        "acc_y": acc_y,
        "acc_z": acc_z,
        "acc_mag": acc_mag,
        "gyro_x": gyro_x,
        "gyro_y": gyro_y,
        "gyro_z": gyro_z,
        "gyro_mag": gyro_mag,
        "acc2_x": acc2_x,
        "acc2_y": acc2_y,
        "acc2_z": acc2_z,
    })

    return df


def find_sisfall_files(data_dir):
    """
    Recursively scans data_dir for all SisFall .txt files.
    """
    pattern = os.path.join(data_dir, "**", "*.txt")
    files = glob.glob(pattern, recursive=True)
    # Filter only valid SisFall recording files
    valid_files = []
    for f in files:
        basename = os.path.basename(f)
        if re.match(r"^[DF]\d{1,2}_[S][AE]\d{1,2}_[R]\d{1,2}", basename, re.IGNORECASE):
            valid_files.append(f)
    valid_files.sort()
    return valid_files


def load_all_sisfall_data(data_dir=DEFAULT_DATA_DIR, max_files=None, verbose=True):
    """
    Loads all SisFall recordings found under data_dir.

    Returns:
        list of pandas.DataFrame (one DataFrame per trial recording)
    """
    if not os.path.exists(data_dir):
        raise FileNotFoundError(
            f"Dataset directory '{data_dir}' does not exist.\n"
            f"Please run 'python data_loader.py --download' to fetch the SisFall dataset."
        )

    files = find_sisfall_files(data_dir)
    if len(files) == 0:
        raise FileNotFoundError(
            f"No valid SisFall trial files found in '{data_dir}'.\n"
            f"Expected files matching pattern '<Activity>_<Subject>_<Trial>.txt'."
        )

    if max_files is not None:
        files = files[:max_files]

    if verbose:
        print(f"Loading {len(files)} SisFall recording files from: {data_dir}")

    trials = []
    for i, fpath in enumerate(files):
        try:
            df_trial = load_single_sisfall_file(fpath)
            trials.append(df_trial)
        except Exception as e:
            if verbose:
                print(f"Warning: Failed to load {os.path.basename(fpath)}: {e}")

    if verbose:
        print(f"Successfully loaded {len(trials)} valid trial recordings.")

    return trials


def download_and_extract_sisfall(dest_dir=DEFAULT_DATA_DIR, url=SISFALL_DOWNLOAD_URL):
    """
    Downloads and extracts the SisFall dataset zip file into dest_dir.
    """
    os.makedirs(dest_dir, exist_ok=True)
    zip_path = os.path.join(os.path.dirname(dest_dir), "SisFall_dataset.zip")

    print("==================================================")
    print("ALTiLINK DATA LOADER — SISFALL DATASET DOWNLOAD")
    print("==================================================")
    print(f"Source URL       : {url}")
    print(f"Destination Zip  : {zip_path}")
    print(f"Target Directory : {dest_dir}")
    print("Downloading dataset archive (~220 MB). Please wait...")

    try:
        def reporthook(blocknum, blocksize, totalsize):
            read = blocknum * blocksize
            if totalsize > 0:
                percent = min(100.0, read * 100.0 / totalsize)
                sys.stdout.write(f"\rDownloading: {percent:5.1f}% ({read // (1024*1024)}MB / {totalsize // (1024*1024)}MB)")
                sys.stdout.flush()

        urllib.request.urlretrieve(url, zip_path, reporthook=reporthook)
        print("\nDownload complete. Extracting archive...")

        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(dest_dir)

        print(f"Extraction complete. Verifying extracted contents in '{dest_dir}'...")
        files = find_sisfall_files(dest_dir)
        print(f"Found {len(files)} valid SisFall recording files.")
        print("==================================================")

        # Cleanup zip to save disk space if extraction succeeded
        if len(files) > 0 and os.path.exists(zip_path):
            os.remove(zip_path)
            print("Removed temporary zip archive.")

        return True

    except Exception as e:
        print(f"\nERROR downloading or extracting dataset: {e}")
        print("\nManual Installation Option:")
        print(f"1. Download SisFall_dataset.zip from {url} or Mendeley Data.")
        print(f"2. Extract the files directly into: {dest_dir}")
        return False


def get_dataset_summary(data_dir=DEFAULT_DATA_DIR):
    """
    Analyzes the available SisFall dataset and prints a structured summary.
    """
    files = find_sisfall_files(data_dir)
    if len(files) == 0:
        print(f"ERROR: No SisFall files found in '{data_dir}'. Run with --download first.")
        return None

    subjects = set()
    young_subjects = set()
    elderly_subjects = set()
    adl_files = 0
    fall_files = 0
    activity_counts = {}

    total_samples = 0
    sample_df = None

    for fpath in files:
        meta = parse_sisfall_filename(fpath)
        sub = meta["subject_id"]
        subjects.add(sub)
        if meta["subject_type"] == "YOUNG":
            young_subjects.add(sub)
        else:
            elderly_subjects.add(sub)

        act = meta["activity_code"]
        activity_counts[act] = activity_counts.get(act, 0) + 1

        if meta["is_fall"] == 1:
            fall_files += 1
        else:
            adl_files += 1

    # Load first file for sensor validation preview
    sample_df = load_single_sisfall_file(files[0])

    print("==================================================")
    print("ALTiLINK FALL DETECTION — DATASET AUDIT SUMMARY")
    print("==================================================")
    print(f"Dataset Location      : {data_dir}")
    print(f"Total Recording Files : {len(files)}")
    print(f"Sampling Frequency    : {SAMPLING_RATE_HZ} Hz")
    print(f"Total Unique Subjects : {len(subjects)}")
    print(f"  - Young Subjects    : {len(young_subjects)} {sorted(list(young_subjects))[:6]}... ({len(young_subjects)} total)")
    print(f"  - Elderly Subjects  : {len(elderly_subjects)} {sorted(list(elderly_subjects))[:6]}... ({len(elderly_subjects)} total)")
    print(f"Class Distribution    :")
    print(f"  - ADL Trials (0)    : {adl_files} ({adl_files*100/len(files):.1f}%)")
    print(f"  - Fall Trials (1)   : {fall_files} ({fall_files*100/len(files):.1f}%)")
    print("Sensor Columns & Units:")
    print("  - ADXL345 Accel (x,y,z) : m/s^2 (calibrated from 13-bit +/-16g)")
    print("  - ITG3200 Gyro (x,y,z)  : rad/s (calibrated from 16-bit +/-2000 dps)")
    print("  - MMA8451Q Accel (x,y,z): m/s^2 (calibrated from 14-bit +/-8g)")
    print(f"Sample Trial Preview ({os.path.basename(files[0])}):")
    print(f"  - Rows: {len(sample_df)}, Duration: {len(sample_df)/SAMPLING_RATE_HZ:.2f} s")
    print(f"  - Mean Accel Mag: {sample_df['acc_mag'].mean():.2f} m/s^2 (~1g gravity baseline)")
    print("==================================================")

    return {
        "total_files": len(files),
        "total_subjects": len(subjects),
        "young_subjects": sorted(list(young_subjects)),
        "elderly_subjects": sorted(list(elderly_subjects)),
        "adl_files": adl_files,
        "fall_files": fall_files,
        "sampling_rate": SAMPLING_RATE_HZ,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AltiLink Fall Detection — SisFall Data Loader & Validator")
    parser.add_argument("--download", action="store_true", help="Download and extract SisFall dataset archive")
    parser.add_argument("--summary", action="store_true", help="Print dataset audit summary and statistics")
    parser.add_argument("--data-dir", type=str, default=DEFAULT_DATA_DIR, help="Path to SisFall data directory")

    args = parser.parse_args()

    if args.download:
        download_and_extract_sisfall(dest_dir=args.data_dir)

    if args.summary or not args.download:
        get_dataset_summary(data_dir=args.data_dir)
