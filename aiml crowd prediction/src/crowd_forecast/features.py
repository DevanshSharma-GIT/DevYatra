"""Feature engineering utilities for forecasting models."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Optional

import numpy as np
import pandas as pd

REQUIRED_COLUMNS = [
    "site",
    "date",
    "time_slot",
    "visitor_count",
    "day_of_week",
    "is_weekend",
    "is_festival",
    "festival_name",
    "weather_temp_c",
    "weather_precip_mm",
    "booked_slots",
]


@dataclass
class FeatureConfig:
    lags: List[int] = None
    rolling_windows: List[int] = None
    min_periods: int = 1
    future_horizons: List[int] = None

    def __post_init__(self) -> None:
        self.lags = self.lags or [1, 2, 7, 14, 28]
        self.rolling_windows = self.rolling_windows or [3, 7, 14]
        self.future_horizons = self.future_horizons or [1, 6, 24]


def _normalize_time_slot(slot: str) -> str:
    raw = str(slot).strip()
    if raw == "":
        return "00:00"
    upper = raw.upper()
    if upper in {"ALL", "TOTAL", "WHOLE"}:
        return "00:00"
    if upper.endswith("H") and upper[:-1].isdigit():
        return f"{int(upper[:-1]):02d}:00"
    if upper.isdigit():
        return f"{int(upper):02d}:00"
    if len(raw) == 5 and raw[2] == ":":
        return raw
    raise ValueError(f"Unrecognized time slot value: {slot}")


def prepare_time_index(df: pd.DataFrame) -> pd.DataFrame:
    if "timestamp" in df.columns:
        return df

    if "time_slot" not in df.columns:
        raise ValueError("Expected 'time_slot' column for timestamp synthesis")

    df = df.copy()
    normalized_slots = df["time_slot"].map(_normalize_time_slot)
    df["timestamp"] = pd.to_datetime(df["date"].astype(str) + " " + normalized_slots, errors="coerce")
    if df["timestamp"].isna().any():
        raise ValueError("Failed to build timestamp from date/time_slot")
    return df


def build_features(
    df: pd.DataFrame,
    feature_config: Optional[FeatureConfig] = None,
    freq: str = "D",
    drop_na: bool = True,
) -> pd.DataFrame:
    config = feature_config or FeatureConfig()

    missing = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    df = prepare_time_index(df)
    df = df.sort_values(["site", "timestamp"]).reset_index(drop=True)

    feature_frames = [
        _build_site_features(site_df, site_name, config, freq)
        for site_name, site_df in df.groupby("site")
    ]

    feature_df = pd.concat(feature_frames, ignore_index=True)

    festival_series = feature_df["festival_name"].copy()
    site_series = feature_df["site"].copy()

    festival_dummies = pd.get_dummies(festival_series, prefix="festival", dummy_na=False)
    site_dummies = pd.get_dummies(site_series, prefix="site", dummy_na=False)
    feature_df = pd.concat([feature_df, festival_dummies, site_dummies], axis=1)

    if drop_na:
        feature_df = feature_df.dropna()

    feature_df = feature_df.sort_values(["site", "ts"]).reset_index(drop=True)

    return feature_df


def _build_site_features(site_df: pd.DataFrame, site_name: str, config: FeatureConfig, freq: str) -> pd.DataFrame:
    site_df = site_df.copy()
    site_df = site_df.set_index("timestamp").asfreq(freq)

    index_ts = pd.to_datetime(site_df.index)
    site_df["date"] = index_ts.strftime("%Y-%m-%d")
    site_df["day_of_week"] = index_ts.dayofweek
    site_df["is_weekend"] = (site_df["day_of_week"] >= 5).astype(int)

    if freq.upper().startswith("H"):
        site_df["time_slot"] = index_ts.strftime("%H:%M")
    else:
        site_df["time_slot"] = "ALL"

    site_df["is_festival"] = site_df["is_festival"].fillna(0).astype(int)
    site_df["festival_name"] = site_df["festival_name"].fillna("None")

    numeric_cols = [
        "weather_temp_c",
        "weather_precip_mm",
        "booked_slots",
    ]
    for col in numeric_cols:
        if col in site_df.columns:
            site_df[col] = site_df[col].interpolate(limit_direction="both").fillna(0)
            if col == "booked_slots":
                site_df[col] = site_df[col].round().astype(int)

    site_df["visitor_count"] = site_df["visitor_count"].fillna(0)

    for lag in config.lags:
        site_df[f"lag_{lag}"] = site_df["visitor_count"].shift(lag)

    for window in config.rolling_windows:
        site_df[f"rolling_mean_{window}"] = (
            site_df["visitor_count"].rolling(window=window, min_periods=config.min_periods).mean()
        )

    for window in config.rolling_windows:
        site_df[f"rolling_std_{window}"] = (
            site_df["visitor_count"].rolling(window=window, min_periods=config.min_periods).std()
        )

    site_df["special_event_flag"] = np.where(site_df["is_festival"] == 1, 1, 0)

    for horizon in config.future_horizons:
        site_df[f"target_t+{horizon}"] = site_df["visitor_count"].shift(-horizon)

    site_df.reset_index(inplace=True)
    site_df.rename(columns={"timestamp": "ts"}, inplace=True)
    site_df["timestamp"] = site_df["ts"]
    site_df["site"] = site_name

    return site_df


__all__ = ["FeatureConfig", "build_features", "prepare_time_index"]
