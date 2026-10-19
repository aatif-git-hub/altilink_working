#!/usr/bin/env python3
"""
AltiLink Local Prototype Server
===============================
Provides:
  1. Direct ML Inference via the existing trained Random Forest model (ml-model/models/fall_detector.joblib)
     and feature extraction pipeline (ml-model/feature_extraction.py).
  2. Multi-device shared group state synchronization for laptop-to-laptop review testing.
"""

import os
import sys
import json
import time
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
import numpy as np
import pandas as pd
import joblib

# Ensure UTF-8 output
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ML_DIR = os.path.join(BASE_DIR, "ml-model")
sys.path.insert(0, ML_DIR)

from feature_extraction import (
    extract_features_from_window,
    DEFAULT_SAMPLING_RATE_HZ,
    DEFAULT_WINDOW_SEC
)

MODEL_PATH = os.path.join(ML_DIR, "models", "fall_detector.joblib")
METRICS_PATH = os.path.join(ML_DIR, "outputs", "metrics.json")
DEMO_DATA_PATH = os.path.join(ML_DIR, "demo_data", "held_out_test_windows.joblib")

# Load ML Artifacts
print("=" * 60)
print("ALTiLINK BACKEND SERVICE — INITIALIZING")
print("=" * 60)

model_bundle = None
rf_model = None
expected_features = []
sampling_rate_hz = 200

if os.path.exists(MODEL_PATH):
    try:
        model_bundle = joblib.load(MODEL_PATH)
        rf_model = model_bundle["model"]
        expected_features = model_bundle["feature_names"]
        sampling_rate_hz = model_bundle.get("sampling_rate_hz", 200)
        print(f"✓ Loaded trained Random Forest model: {len(expected_features)} features, {rf_model.n_estimators} estimators")
    except Exception as e:
        print(f"⚠️ Error loading model artifact: {e}")
else:
    print(f"⚠️ Model artifact not found at: {MODEL_PATH}")

metrics_data = {}
if os.path.exists(METRICS_PATH):
    try:
        with open(METRICS_PATH, "r", encoding="utf-8") as f:
            metrics_data = json.load(f)
        print(f"✓ Loaded evaluation metrics: Acc {metrics_data.get('test_metrics', {}).get('accuracy', 0)*100:.1f}%")
    except Exception as e:
        print(f"⚠️ Error loading metrics: {e}")

heldout_demo_samples = []
if os.path.exists(DEMO_DATA_PATH):
    try:
        heldout_demo_samples = joblib.load(DEMO_DATA_PATH)
        print(f"✓ Loaded {len(heldout_demo_samples)} held-out test windows from SisFall")
    except Exception as e:
        print(f"⚠️ Error loading demo samples: {e}")

# In-memory shared state registry for multi-device group sync
groups_registry = {}

class AltiLinkHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")
        query = urllib.parse.parse_qs(parsed.query)

        # Health / status
        if path == "/api/health" or path == "":
            return self._send_json(200, {
                "status": "online",
                "service": "AltiLink ML & Multi-Device Backend",
                "model_loaded": rf_model is not None,
                "feature_count": len(expected_features),
                "sampling_rate_hz": sampling_rate_hz
            })

        # ML Metrics
        if path == "/api/ml/metrics":
            return self._send_json(200, metrics_data)

        # Held-out demo samples
        if path == "/api/ml/heldout_samples":
            serialized_samples = []
            for s in heldout_demo_samples:
                serialized_samples.append({
                    "subject_id": s["subject_id"],
                    "subject_type": s["subject_type"],
                    "activity_code": s["activity_code"],
                    "label": int(s["label"]),
                    "label_name": "FALL" if s["label"] == 1 else "NORMAL",
                    "sample_count": len(s["raw_df"])
                })
            return self._send_json(200, serialized_samples)

        # Fetch group state
        if path.startswith("/api/groups/"):
            code = path.split("/api/groups/")[1].upper()
            if code in groups_registry:
                return self._send_json(200, groups_registry[code])
            else:
                return self._send_json(404, {"error": f"Group {code} not found"})

        # List all groups
        if path == "/api/groups":
            return self._send_json(200, groups_registry)

        return self._send_json(404, {"error": "Not Found"})

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")

        content_length = int(self.headers.get("Content-Length", 0))
        body = {}
        if content_length > 0:
            raw_body = self.rfile.read(content_length).decode("utf-8")
            try:
                body = json.loads(raw_body)
            except Exception:
                pass

        # 1. ML Inference via existing Random Forest Model
        if path == "/api/ml/predict":
            if rf_model is None:
                return self._send_json(500, {"error": "ML Model not loaded"})

            try:
                samples = body.get("samples", [])
                if not samples or len(samples) < 10:
                    return self._send_json(400, {"error": "At least 10 IMU samples required for window analysis"})

                # Convert incoming samples to DataFrame expected by extract_features_from_window
                df_window = pd.DataFrame(samples)
                required_cols = ["acc_x", "acc_y", "acc_z", "gyro_x", "gyro_y", "gyro_z"]
                for col in required_cols:
                    if col not in df_window.columns:
                        df_window[col] = 0.0

                if "acc_mag" not in df_window.columns:
                    df_window["acc_mag"] = np.sqrt(df_window["acc_x"]**2 + df_window["acc_y"]**2 + df_window["acc_z"]**2)
                if "gyro_mag" not in df_window.columns:
                    df_window["gyro_mag"] = np.sqrt(df_window["gyro_x"]**2 + df_window["gyro_y"]**2 + df_window["gyro_z"]**2)

                # Extract features using the EXACT same feature extraction module
                t_start = time.perf_counter()
                feat_dict = extract_features_from_window(df_window, fs=sampling_rate_hz)

                # Build feature vector in exact order
                feature_vector = np.array([[feat_dict[fn] for fn in expected_features]])

                # Predict
                pred_label = int(rf_model.predict(feature_vector)[0])
                pred_probs = rf_model.predict_proba(feature_vector)[0]
                t_infer_ms = (time.perf_counter() - t_start) * 1000.0

                confidence_pct = float(pred_probs[pred_label] * 100.0)
                pred_str = "FALL" if pred_label == 1 else "NORMAL"

                # Extract key biomechanical highlights
                highlights = {
                    "peak_accel_g": float(feat_dict["max_amag"] / 9.80665),
                    "peak_accel_ms2": float(feat_dict["max_amag"]),
                    "max_jerk": float(feat_dict["max_jerk"]),
                    "tilt_diff_deg": float(feat_dict["tilt_diff"]),
                    "mean_tilt_deg": float(feat_dict["mean_tilt"]),
                    "rms_gyro": float(feat_dict["rms_gmag"]),
                }

                return self._send_json(200, {
                    "prediction": pred_str,
                    "label": pred_label,
                    "confidence": round(confidence_pct, 1),
                    "prob_fall": float(pred_probs[1] if len(pred_probs) > 1 else 0.0),
                    "prob_normal": float(pred_probs[0]),
                    "inference_latency_ms": round(t_infer_ms, 2),
                    "key_features": highlights,
                    "feature_count": len(expected_features),
                    "model_type": "RandomForestClassifier (200 trees, SisFall benchmark)"
                })
            except Exception as e:
                return self._send_json(500, {"error": f"Inference error: {str(e)}"})

        # 2. Multi-Device Group Management
        if path == "/api/groups":
            # Create group
            group_code = body.get("code", "").upper().strip()
            if not group_code:
                return self._send_json(400, {"error": "Group code required"})

            group_data = {
                "profile": body.get("profile", {
                    "id": group_code,
                    "code": group_code,
                    "name": body.get("groupName", "Western Ghats Trek"),
                    "createdAt": time.strftime("%H:%M:%S"),
                    "leaderId": body.get("leaderId", "M01"),
                }),
                "members": body.get("members", []),
                "hikeState": body.get("hikeState", "GROUP_LOBBY"),
                "trekMode": body.get("trekMode", "EXISTING"),
                "selectedTrail": body.get("selectedTrail", None),
                "checkpointInterval": body.get("checkpointInterval", 5),
                "checkpoints": body.get("checkpoints", []),
                "activeEmergency": None,
                "emergencyHistory": [],
                "updatedAt": int(time.time() * 1000)
            }
            groups_registry[group_code] = group_data
            print(f"Group created on backend: {group_code} ({group_data['profile']['name']})")
            return self._send_json(200, group_data)

        # 3. Join Group
        if path.endswith("/join"):
            group_code = path.split("/api/groups/")[1].split("/join")[0].upper()
            if group_code not in groups_registry:
                return self._send_json(404, {"error": f"Group {group_code} does not exist"})

            new_member = body.get("member")
            if not new_member:
                return self._send_json(400, {"error": "Member object required"})

            existing_members = [m for m in groups_registry[group_code]["members"] if m["id"] != new_member["id"]]
            groups_registry[group_code]["members"] = existing_members + [new_member]
            groups_registry[group_code]["updatedAt"] = int(time.time() * 1000)
            print(f"Member {new_member['name']} ({new_member['id']}) joined group {group_code}")
            return self._send_json(200, groups_registry[group_code])

        # 4. Update Hike Setup & Start Hike (Leader only)
        if path.endswith("/hike/start"):
            group_code = path.split("/api/groups/")[1].split("/hike/start")[0].upper()
            if group_code not in groups_registry:
                return self._send_json(404, {"error": "Group not found"})

            groups_registry[group_code]["hikeState"] = "ACTIVE_HIKE"
            if "trekMode" in body:
                groups_registry[group_code]["trekMode"] = body["trekMode"]
            if "selectedTrail" in body:
                groups_registry[group_code]["selectedTrail"] = body["selectedTrail"]
            if "checkpointInterval" in body:
                groups_registry[group_code]["checkpointInterval"] = body["checkpointInterval"]
            if "checkpoints" in body:
                groups_registry[group_code]["checkpoints"] = body["checkpoints"]

            groups_registry[group_code]["updatedAt"] = int(time.time() * 1000)
            print(f"Hike STARTED for group {group_code} (Trek: {groups_registry[group_code].get('trekMode')})")
            return self._send_json(200, groups_registry[group_code])

        # 5. End Hike
        if path.endswith("/hike/end"):
            group_code = path.split("/api/groups/")[1].split("/hike/end")[0].upper()
            if group_code in groups_registry:
                groups_registry[group_code]["hikeState"] = "GROUP_LOBBY"
                groups_registry[group_code]["activeEmergency"] = None
                groups_registry[group_code]["updatedAt"] = int(time.time() * 1000)
                print(f"Hike ENDED for group {group_code}")
                return self._send_json(200, groups_registry[group_code])

        # 6. Add Dynamic Checkpoint
        if path.endswith("/checkpoints/delete"):
            group_code = path.split("/api/groups/")[1].split("/checkpoints/delete")[0].upper()
            if group_code in groups_registry:
                cp_id = body.get("checkpointId")
                if cp_id:
                    current_cps = [c for c in groups_registry[group_code].get("checkpoints", []) if c["id"] != cp_id]
                    groups_registry[group_code]["checkpoints"] = current_cps
                    groups_registry[group_code]["updatedAt"] = int(time.time() * 1000)
                    print(f"Checkpoint {cp_id} deleted from group {group_code}")
                    return self._send_json(200, groups_registry[group_code])

        if path.endswith("/checkpoints"):
            group_code = path.split("/api/groups/")[1].split("/checkpoints")[0].upper()
            if group_code in groups_registry:
                cp = body.get("checkpoint")
                if cp:
                    current_cps = [c for c in groups_registry[group_code].get("checkpoints", []) if c["id"] != cp["id"]]
                    groups_registry[group_code]["checkpoints"] = current_cps + [cp]
                    groups_registry[group_code]["updatedAt"] = int(time.time() * 1000)
                    return self._send_json(200, groups_registry[group_code])

        # 7. Emergency Broadcast (SOS / Fall)
        if path.endswith("/emergency"):
            group_code = path.split("/api/groups/")[1].split("/emergency")[0].upper()
            if group_code in groups_registry:
                packet = body.get("packet")
                groups_registry[group_code]["activeEmergency"] = packet
                if packet:
                    hist = groups_registry[group_code].get("emergencyHistory", [])
                    groups_registry[group_code]["emergencyHistory"] = [packet] + [h for h in hist if h.get("packetID") != packet.get("packetID")]
                groups_registry[group_code]["updatedAt"] = int(time.time() * 1000)
                print(f"🚨 EMERGENCY BROADCAST on group {group_code}: {packet.get('messageType')} from {packet.get('senderName')}")
                return self._send_json(200, groups_registry[group_code])

        # 8. Emergency Resolve
        if path.endswith("/emergency/resolve"):
            group_code = path.split("/api/groups/")[1].split("/emergency/resolve")[0].upper()
            if group_code in groups_registry:
                groups_registry[group_code]["activeEmergency"] = None
                groups_registry[group_code]["updatedAt"] = int(time.time() * 1000)
                print(f"✓ Emergency resolved for group {group_code}")
                return self._send_json(200, groups_registry[group_code])

        return self._send_json(404, {"error": "Endpoint not found"})


def run_server(port=3001):
    server_address = ("0.0.0.0", port)
    httpd = HTTPServer(server_address, AltiLinkHandler)
    print(f"AltiLink Backend Server listening on http://0.0.0.0:{port}")
    print(f"ML Pipeline: ml-model/models/fall_detector.joblib active")
    print(f"Ready for multi-device sync and live fall classification.\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="AltiLink Backend Server")
    parser.add_argument("--port", type=int, default=3001, help="Port to listen on")
    args = parser.parse_args()
    run_server(port=args.port)
