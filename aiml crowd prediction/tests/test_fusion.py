"""Tests for forecast and detection fusion."""

from __future__ import annotations

import pandas as pd

from crowd_forecast.fusion import FusionConfig, FusionEngine, merge_forecast_detection


def _sample_forecasts() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "site": ["Ambaji", "Ambaji", "Dwarka"],
            "ts": ["2024-01-01 00:00", "2024-01-01 01:00", "2024-01-01 00:00"],
            "forecast": [50000.0, 52000.0, 43000.0],
            "forecast_std": [5000.0, 4000.0, 3500.0],
        }
    )


def _sample_detections() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "site": ["Ambaji", "Ambaji", "Dwarka"],
            "ts": ["2024-01-01 00:00", "2024-01-01 01:00", "2024-01-01 00:00"],
            "detection_count": [55000, 51000, 44000],
            "detection_confidence": [0.9, 0.4, 0.7],
        }
    )


def test_merge_helper_standardises_columns():
    merged = merge_forecast_detection(_sample_forecasts(), _sample_detections())
    assert {"forecast", "forecast_std", "detection_count", "detection_confidence"}.issubset(merged.columns)
    assert len(merged) == 3


def test_fusion_engine_produces_weighted_estimates():
    merged = merge_forecast_detection(_sample_forecasts(), _sample_detections())
    engine = FusionEngine(FusionConfig(smoothing_window=1))
    fused = engine.fuse(merged)

    assert "fused_estimate" in fused.columns
    assert fused.loc[0, "fusion_weight_detection"] > fused.loc[0, "fusion_weight_forecast"]  # high confidence detection
    assert fused.loc[1, "fusion_weight_detection"] < fused.loc[1, "fusion_weight_forecast"]  # low confidence detection
    assert fused.loc[0, "fused_estimate"] >= 0
    assert fused.loc[0, "residual_vs_forecast"] != fused.loc[0, "residual_vs_detection"]


def test_fusion_engine_applies_smoothing():
    merged = merge_forecast_detection(_sample_forecasts(), _sample_detections())
    engine = FusionEngine(FusionConfig(smoothing_window=2, smoothing_min_periods=1))
    fused = engine.fuse(merged)
    assert fused.loc[1, "fused_estimate"] != fused.loc[1, "fused_estimate_raw"]