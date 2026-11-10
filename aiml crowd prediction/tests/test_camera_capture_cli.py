from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pandas as pd


def test_run_camera_capture_cli(tmp_path: Path):
    cfg_path = tmp_path / "camera_config.json"
    cfg_payload = {
        "cameras": [
            {"camera_id": "cam-1", "site": "Ambaji", "source": "sim:1"},
            {"camera_id": "cam-2", "site": "Dwarka", "source": "sim:2"},
        ]
    }
    cfg_path.write_text(json.dumps(cfg_payload), encoding="utf-8")

    detection_dir = tmp_path / "detections"
    forecast_dir = tmp_path / "forecasts"
    metadata_dir = tmp_path / "meta"
    events_dir = tmp_path / "events"

    cmd = [
        sys.executable,
        "-m",
        "crowd_forecast.scripts.run_camera_capture",
        "--config",
        str(cfg_path),
        "--detection-dir",
        str(detection_dir),
        "--forecast-dir",
        str(forecast_dir),
        "--metadata-dir",
        str(metadata_dir),
    "--events-dir",
    str(events_dir),
        "--interval-sec",
        "0.1",
        "--max-batches",
        "1",
        "--simulate",
        "--simulate-seed",
        "99",
    ]

    env = os.environ.copy()
    project_root = Path(__file__).resolve().parents[2]
    env.setdefault("PYTHONPATH", str(project_root / "src"))

    completed = subprocess.run(cmd, env=env, check=True)
    assert completed.returncode == 0

    detection_files = list(detection_dir.glob("*.csv"))
    forecast_files = list(forecast_dir.glob("*.csv"))
    metadata_files = list(metadata_dir.glob("*.json"))
    events_files = list(events_dir.glob("*_events.csv"))

    assert len(detection_files) == 1
    assert len(forecast_files) == 1
    assert len(metadata_files) == 1
    assert len(events_files) == 1

    detection_df = pd.read_csv(detection_files[0])
    forecast_df = pd.read_csv(forecast_files[0])
    events_df = pd.read_csv(events_files[0])

    assert set(detection_df.columns) >= {"site", "ts", "detection_count"}
    assert set(forecast_df.columns) >= {"site", "ts", "forecast"}
    assert detection_df["site"].isin(["Ambaji", "Dwarka"]).all()
    assert forecast_df["site"].isin(["Ambaji", "Dwarka"]).all()
    assert {"camera_id", "class_name", "bbox_x1", "bbox_y1", "bbox_x2", "bbox_y2"}.issubset(events_df.columns)
