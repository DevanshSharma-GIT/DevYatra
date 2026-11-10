from __future__ import annotations

import math
from pathlib import Path

import pandas as pd

from crowd_forecast.capture import (
    CameraConfig,
    CaptureOrchestrator,
    CaptureSettings,
    SimpleSiteForecaster,
)


def test_simple_site_forecaster_smoothing():
    forecaster = SimpleSiteForecaster(alpha=0.5, window=4)
    observations = [100, 120, 80, 110]
    forecasts = []
    stds = []
    for obs in observations:
        forecast, std = forecaster.update(obs)
        forecasts.append(forecast)
        stds.append(std)

    assert math.isclose(forecasts[0], 100.0)
    assert 90 < forecasts[-1] < 120
    assert stds[-1] > 0


def test_capture_orchestrator_simulation(tmp_path: Path):
    camera_cfgs = [
        CameraConfig(camera_id="cam-1", site="Ambaji", source="sim:1"),
        CameraConfig(camera_id="cam-2", site="Somnath", source="sim:2"),
    ]

    settings = CaptureSettings(interval_sec=0.1, smoothing_alpha=0.5, forecast_window=5)

    orchestrator = CaptureOrchestrator(
        cameras=camera_cfgs,
        settings=settings,
        detector_factory=lambda *args, **kwargs: None,
        model_path="dummy.pt",
        detection_config_overrides={},
        simulate=True,
        simulate_seed=42,
    )

    try:
        batch = orchestrator.collect_batch()
    finally:
        orchestrator.close()

    assert batch.key.startswith("camera_")
    assert not batch.detections.empty
    assert set(batch.detections.columns) >= {"site", "ts", "detection_count", "detection_confidence"}
    assert set(batch.forecasts.columns) >= {"site", "ts", "forecast", "forecast_std"}
    pd.to_datetime(batch.detections["ts"])  # ensure convertible without raising
    assert len(batch.detections) == 2
    assert len(batch.forecasts) == 2
    assert batch.events is not None
    assert not batch.events.empty
    assert {"camera_id", "class_name", "bbox_x1", "bbox_y1", "bbox_x2", "bbox_y2"}.issubset(batch.events.columns)
    assert batch.events["is_person"].all()