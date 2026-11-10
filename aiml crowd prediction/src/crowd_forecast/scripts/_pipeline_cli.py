"""Shared helpers for pipeline-related CLI scripts."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from pydantic import BaseModel

from crowd_forecast import AlertConfig, FusionConfig, PipelineConfig


class PipelineCliConfig(BaseModel):
    detection_weight: float = 0.6
    forecast_weight: float = 0.4
    smoothing_window: int = 3
    clip_min: float = 0.0
    clip_max: float | None = None
    warning_ratio: float = 0.75
    critical_ratio: float = 0.9
    sustained_window: int = 3
    detection_spike: float = 0.25
    default_capacity: float | None = None
    site_capacity: dict[str, float] | None = None


def load_pipeline_config(path: Path | None) -> PipelineConfig:
    base = PipelineCliConfig()
    if path and path.exists():
        payload = json.loads(path.read_text(encoding="utf-8"))
        base = PipelineCliConfig(**payload)

    fusion = FusionConfig(
        detection_weight=base.detection_weight,
        forecast_weight=base.forecast_weight,
        smoothing_window=base.smoothing_window,
        clip_min=base.clip_min,
        clip_max=base.clip_max,
    )
    alert = AlertConfig(
        warning_ratio=base.warning_ratio,
        critical_ratio=base.critical_ratio,
        sustained_window=base.sustained_window,
        detection_spike_ratio=base.detection_spike,
        default_capacity=base.default_capacity,
        site_capacity=base.site_capacity or {},
    )
    return PipelineConfig(fusion=fusion, alert=alert)


def ensure_detection_frame(forecasts: pd.DataFrame, detections: pd.DataFrame, default_confidence: float = 0.0) -> pd.DataFrame:
    """Ensure detection frame has required columns, synthesising when needed."""

    if not detections.empty:
        required = {"site", "ts", "detection_count"}
        missing = required.difference(detections.columns)
        if missing:
            raise ValueError(f"Detections missing required columns: {sorted(missing)}")
        detections = detections.copy()
        if "detection_confidence" not in detections.columns:
            detections["detection_confidence"] = default_confidence
        return detections

    required_forecast_cols = {"site", "ts", "forecast"}
    missing_forecast = required_forecast_cols.difference(forecasts.columns)
    if missing_forecast:
        raise ValueError(f"Cannot synthesise detections; forecasts missing columns: {sorted(missing_forecast)}")

    synthesized = forecasts[list(required_forecast_cols)].copy()
    synthesized.rename(columns={"forecast": "detection_count"}, inplace=True)
    synthesized["detection_confidence"] = default_confidence
    return synthesized


__all__ = ["PipelineCliConfig", "load_pipeline_config", "ensure_detection_frame"]