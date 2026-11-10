"""Signal fusion utilities for combining forecasts and detection counts."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

import numpy as np
import pandas as pd


@dataclass
class FusionConfig:
    """Configuration for the :class:`FusionEngine`."""

    detection_weight: float = 0.6
    forecast_weight: float = 0.4
    min_detection_confidence: float = 0.1
    smoothing_window: int = 3
    smoothing_min_periods: int = 1
    clip_min: Optional[float] = 0.0
    clip_max: Optional[float] = None
    forecast_floor: float = 1.0

    def __post_init__(self) -> None:
        if self.detection_weight < 0 or self.forecast_weight < 0:
            raise ValueError("Fusion weights must be non-negative")
        if self.smoothing_window < 1:
            raise ValueError("smoothing_window must be >= 1")
        if self.smoothing_min_periods < 1:
            raise ValueError("smoothing_min_periods must be >= 1")


class FusionEngine:
    """Fuse forecasts with real-time detection signals."""

    REQUIRED_COLUMNS = {"site", "ts", "forecast", "detection_count"}

    def __init__(self, config: Optional[FusionConfig] = None) -> None:
        self.config = config or FusionConfig()

    def fuse(self, df: pd.DataFrame) -> pd.DataFrame:
        missing = self.REQUIRED_COLUMNS.difference(df.columns)
        if missing:
            raise ValueError(f"Missing required columns for fusion: {sorted(missing)}")

        fused = df.copy()
        fused["ts"] = pd.to_datetime(fused["ts"])

        if "detection_confidence" not in fused.columns:
            fused["detection_confidence"] = 1.0
        if "forecast_std" not in fused.columns:
            fused["forecast_std"] = np.nan

        fused["detection_confidence"] = fused["detection_confidence"].fillna(self.config.min_detection_confidence)
        fused["forecast_std"] = fused["forecast_std"].fillna(0.0)

        detection_conf = np.clip(fused["detection_confidence"], self.config.min_detection_confidence, 1.0)
        detection_weight = self.config.detection_weight * detection_conf

        reliability = 1.0 / (1.0 + (fused["forecast_std"].abs() / (fused["forecast"].abs() + self.config.forecast_floor)))
        forecast_weight = self.config.forecast_weight * reliability

        total_weight = detection_weight + forecast_weight

        # Default to equal weighting when total weight collapses to zero
        detection_share = np.divide(
            detection_weight,
            total_weight,
            out=np.full_like(detection_weight, 0.5, dtype=float),
            where=total_weight > 0,
        )
        forecast_share = np.divide(
            forecast_weight,
            total_weight,
            out=np.full_like(forecast_weight, 0.5, dtype=float),
            where=total_weight > 0,
        )

        # Normalise to ensure the shares sum to one
        share_sum = detection_share + forecast_share
        nonzero = share_sum > 0
        detection_share = np.where(nonzero, detection_share / share_sum, detection_share)
        forecast_share = np.where(nonzero, forecast_share / share_sum, forecast_share)

        fused["fusion_weight_detection"] = detection_share
        fused["fusion_weight_forecast"] = forecast_share
        fused["fused_estimate_raw"] = (
            fused["fusion_weight_detection"] * fused["detection_count"]
            + fused["fusion_weight_forecast"] * fused["forecast"]
        )

        if self.config.smoothing_window > 1:
            fused = fused.sort_values(["site", "ts"]).reset_index(drop=True)
            fused["fused_estimate"] = (
                fused.groupby("site")["fused_estimate_raw"].transform(
                    lambda s: s.rolling(self.config.smoothing_window, min_periods=self.config.smoothing_min_periods).mean()
                )
            )
        else:
            fused["fused_estimate"] = fused["fused_estimate_raw"]

        if self.config.clip_min is not None or self.config.clip_max is not None:
            fused["fused_estimate"] = fused["fused_estimate"].clip(lower=self.config.clip_min, upper=self.config.clip_max)

        fused["residual_vs_detection"] = fused["fused_estimate"] - fused["detection_count"]
        fused["residual_vs_forecast"] = fused["fused_estimate"] - fused["forecast"]

        return fused


def merge_forecast_detection(
    forecasts: pd.DataFrame,
    detections: pd.DataFrame,
    on: Optional[Dict[str, str]] = None,
) -> pd.DataFrame:
    """Utility to merge forecast outputs with detection counts.

    Parameters
    ----------
    forecasts:
        DataFrame that must contain ``site`` and ``ts`` columns, along with ``forecast``
        (and optionally ``forecast_std``).
    detections:
        DataFrame that must contain ``site`` and ``ts`` columns, along with
        ``detection_count`` (and optionally ``detection_confidence``).
    on:
        Optional column mapping if the join keys are named differently in the
        two dataframes. When provided it should map forecast column names to
        detection column names.
    """

    key_map = on or {"site": "site", "ts": "ts"}
    left_on = ["site", "ts"]
    right_on = [key_map.get("site", "site"), key_map.get("ts", "ts")]

    merged = forecasts.merge(
        detections,
        left_on=left_on,
        right_on=right_on,
        how="inner",
        suffixes=("_forecast", "_detection"),
    )

    # Standardise column names
    column_renames = {
        "forecast": "forecast",
        "forecast_std": "forecast_std",
        "detection_count": "detection_count",
        "detection_confidence": "detection_confidence",
    }

    for col in list(column_renames):
        if f"{col}_forecast" in merged.columns:
            merged.rename(columns={f"{col}_forecast": col}, inplace=True)
        if f"{col}_detection" in merged.columns:
            merged.rename(columns={f"{col}_detection": col}, inplace=True)

    merged["ts"] = pd.to_datetime(merged["ts"])
    return merged


__all__ = ["FusionConfig", "FusionEngine", "merge_forecast_detection"]