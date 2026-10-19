# SisFall Dataset Documentation & Setup Guide

## Dataset Overview
The **SisFall** dataset is an open-access benchmark dataset for fall detection and human activity recognition (HAR), developed by the SISTEMIC research group at Universidad de Antioquia (Medellín, Colombia).

* **Official Citation:** Sucerquia, A.; López, J.D.; Vargas-Bonilla, J.F. *SisFall: A Fall and Movement Dataset.* Sensors 2017, 17(1), 198. DOI: [10.3390/s17010198](https://doi.org/10.3390/s17010198)
* **Primary Hosting / Mirrors:**
  - Official MDPI Sensors supplementary repository
  - Mendeley Data: [https://data.mendeley.com/datasets/72fy7xzs3r/1](https://data.mendeley.com/datasets/72fy7xzs3r/1)
  - Hugging Face Open Mirror: [https://huggingface.co/datasets/abys7315/Sisfall_Dataset](https://huggingface.co/datasets/abys7315/Sisfall_Dataset)

---

## Sensor Specifications & Placement
Data was recorded using a custom-designed wearable sensor pack fixed to the **waist** of participants, comprising three synchronized inertial sensors sampled at **200 Hz**:

1. **ADXL345 Triaxial Accelerometer:**
   - Dynamic Range: $\pm 16\text{g}$
   - Resolution: 13-bit ADC
   - Scale factor: $\frac{32}{8192} = 0.00390625\text{ g/LSB}$
2. **ITG3200 Triaxial Gyroscope:**
   - Dynamic Range: $\pm 2000^\circ/\text{s}$
   - Resolution: 16-bit ADC
   - Scale factor: $\frac{4000}{65536} \approx 0.061035^\circ/\text{s/LSB}$
3. **MMA8451Q Triaxial Accelerometer:**
   - Dynamic Range: $\pm 8\text{g}$
   - Resolution: 14-bit ADC
   - Scale factor: $\frac{16}{16384} = 0.0009765625\text{ g/LSB}$

---

## Cohort & Activity Taxonomy
* **Participants:** 38 total subjects
  - 23 young adult subjects (`SA01` – `SA23`), aged 19–30 years
  - 15 elderly adult subjects (`SE01` – `SE15`), aged 60–75 years
* **Activities Recorded:**
  - **19 Activities of Daily Living (ADLs):** `D01` to `D19` (walking, jogging, stair ascent/descent, sitting, standing, stumbling with recovery, etc.)
  - **15 Fall Types:** `F01` to `F15` (forward falls, backward falls, lateral falls, syncope/faint falls, sit-to-fall transitions)

---

## File Naming Convention & Structure
Each trial is stored as a raw ASCII text file named:
```
<Activity_Code>_<Subject_Code>_<Trial_Code>.txt
Example: D01_SA01_R01.txt   (ADL 1, Young Subject 1, Trial 1)
Example: F05_SE03_R02.txt   (Fall 5, Elderly Subject 3, Trial 2)
```

Each text file contains 9 comma-separated integer columns per line:
`[ADXL345_ax, ADXL345_ay, ADXL345_az, ITG3200_gx, ITG3200_gy, ITG3200_gz, MMA8451Q_ax, MMA8451Q_ay, MMA8451Q_az]`

---

## Automatic Download & Extraction
To download and verify the dataset automatically, run:
```bash
python data_loader.py --download
```
Or download `SisFall_dataset.zip` manually and extract its subject folders into `data/sisfall/`.
