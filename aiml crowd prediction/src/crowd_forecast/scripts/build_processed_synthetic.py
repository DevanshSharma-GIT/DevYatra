"""Produce high-signal synthetic CSVs for demos and model experimentation."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Tuple

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from crowd_forecast import (  # noqa: E402
    AppConfig,
    PipelineRunner,
    SyntheticGenerationSettings,
    generate_synthetic_dataset,
)
from crowd_forecast.scripts._pipeline_cli import load_pipeline_config  # noqa: E402

DATA_DIR = Path("data/processed")
DEFAULT_PIPELINE_CONFIG = Path("pipeline_config.json")
TRAINING_EXPORT = DATA_DIR / "historical_daily_counts.csv"
METADATA_EXPORT = DATA_DIR / "synthetic_metadata.json"

FUSED_EXPORTS = [
    DATA_DIR / "batch1_fused.csv",
    DATA_DIR / "batch2_fused.csv",
]
ALERT_EXPORTS = [
    DATA_DIR / "batch1_alerts.csv",
    DATA_DIR / "batch2_alerts.csv",
]


def _to_iso(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series).dt.strftime("%Y-%m-%d")


def _compute_detection_measurements(df: pd.DataFrame, rng: np.random.Generator) -> Tuple[pd.Series, pd.Series]:
    true_visitors = df["true_visitors"].to_numpy(dtype=float)
    precip = df["weather_precip_mm"].to_numpy(dtype=float)
    is_weekend = df["is_weekend"].to_numpy(dtype=float)

    measurement_noise = rng.normal(loc=0.0, scale=0.05, size=true_visitors.size)
    detection = np.maximum(true_visitors * (1.0 + measurement_noise), 0.0)

    base_conf = 0.65 + 0.12 * np.exp(-precip / 12.0)
    weekend_bonus = 0.05 * (1.0 - is_weekend)
    conf_noise = rng.normal(loc=0.0, scale=0.03, size=true_visitors.size)
    confidence = np.clip(base_conf + weekend_bonus + conf_noise, 0.5, 0.95)

    return detection.round().astype(int), confidence


def _compute_forecasts(df: pd.DataFrame, rng: np.random.Generator) -> Tuple[pd.Series, pd.Series]:
    forecasts: list[np.ndarray] = []
    stds: list[np.ndarray] = []

    for site, site_df in df.groupby("site", sort=True):
        site_df = site_df.sort_values("ts")
        history = site_df["true_visitors"].to_numpy(dtype=float)
        is_festival = site_df["is_festival"].to_numpy(dtype=float)
        is_weekend = site_df["is_weekend"].to_numpy(dtype=float)

        rolling_mean = pd.Series(history).shift(1).rolling(window=7, min_periods=3).mean().to_numpy()
        trend = pd.Series(history).pct_change(periods=30).fillna(0.0).to_numpy()

        noise = rng.normal(loc=0.0, scale=0.08, size=history.size)
        weekend_push = rng.normal(loc=0.03, scale=0.02, size=history.size) * is_weekend
        festival_bias = rng.uniform(0.12, 0.32, size=history.size) * is_festival

        base_forecast = rolling_mean * (1.0 + noise + weekend_push - festival_bias) * (1.0 + 0.5 * trend)

        fallback = np.cumsum(history) / np.arange(1, history.size + 1)
        base_forecast = np.where(~np.isfinite(base_forecast) | (base_forecast <= 0), fallback, base_forecast)
        base_forecast = np.maximum(base_forecast, 0.0)

        forecast_std = np.maximum(np.abs(base_forecast - history) * 0.5, np.maximum(base_forecast * 0.06, 75.0))

        forecasts.append(base_forecast)
        stds.append(forecast_std)

    return pd.Series(np.concatenate(forecasts)), pd.Series(np.concatenate(stds))


def _prepare_frames(settings: SyntheticGenerationSettings, seed: int) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, dict]:
    config = AppConfig.default()
    df, metadata = generate_synthetic_dataset(config=config, settings=settings, seed=seed)

    daily = df[df["time_slot"] == "ALL"].copy()
    daily.rename(columns={"date": "ts", "visitor_count": "true_visitors"}, inplace=True)
    daily.sort_values(["site", "ts"], inplace=True)
    daily.reset_index(drop=True, inplace=True)

    rng = np.random.default_rng(seed + 17)

    detection_count, detection_confidence = _compute_detection_measurements(daily, rng)
    forecast, forecast_std = _compute_forecasts(daily, rng)

    daily["ts"] = pd.to_datetime(daily["ts"])
    daily["detection_count"] = detection_count
    daily["detection_confidence"] = detection_confidence
    daily["forecast"] = forecast.round().clip(lower=0).astype(int)
    daily["forecast_std"] = forecast_std

    detections = daily[["site", "ts", "detection_count", "detection_confidence"]].copy()
    forecasts = daily[["site", "ts", "forecast", "forecast_std"]].copy()

    training = daily[
        [
            "site",
            "ts",
            "true_visitors",
            "detection_count",
            "detection_confidence",
            "forecast",
            "forecast_std",
            "is_weekend",
            "is_festival",
            "festival_name",
            "weather_temp_c",
            "weather_precip_mm",
        ]
    ].copy()

    metadata_dict = asdict(metadata)
    metadata_dict.update({
        "seed": seed,
        "settings": {
            "years": settings.years,
            "start_year": settings.start_year,
            "hourly": settings.include_hourly,
        },
    })

    return detections, forecasts, training, metadata_dict


def _write_outputs(
    fused: pd.DataFrame,
    alerts: pd.DataFrame,
    training: pd.DataFrame,
    metadata: dict,
) -> None:
    fused = fused.copy()
    alerts = alerts.copy()

    fused["ts"] = _to_iso(fused["ts"])
    alerts["ts"] = _to_iso(alerts["ts"])
    training["ts"] = _to_iso(training["ts"])

    fused_cols = [
        "site",
        "ts",
        "forecast",
        "forecast_std",
        "detection_count",
        "detection_confidence",
        "fusion_weight_detection",
        "fusion_weight_forecast",
        "fused_estimate_raw",
        "fused_estimate",
        "residual_vs_detection",
        "residual_vs_forecast",
    ]
    fused = fused[[col for col in fused_cols if col in fused.columns]].copy()

    alerts_cols = [
        "site",
        "ts",
        "forecast",
        "forecast_std",
        "detection_count",
        "detection_confidence",
        "fusion_weight_detection",
        "fusion_weight_forecast",
        "fused_estimate_raw",
        "fused_estimate",
        "residual_vs_detection",
        "residual_vs_forecast",
        "capacity",
        "occupancy_ratio",
        "occupancy_ratio_smoothed",
        "alert_level",
        "alert_message",
    ]
    alerts = alerts[[col for col in alerts_cols if col in alerts.columns]].copy()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    training.to_csv(TRAINING_EXPORT, index=False)
    METADATA_EXPORT.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    for path in FUSED_EXPORTS:
        fused.to_csv(path, index=False)
    for path in ALERT_EXPORTS:
        alerts.to_csv(path, index=False)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--years", type=int, default=3, help="Years of data to synthesise (default: 3)")
    parser.add_argument("--start-year", type=int, default=2022, help="Start year for synthesis (default: 2022)")
    parser.add_argument("--seed", type=int, default=2025, help="Random seed for reproducibility")
    parser.add_argument(
        "--pipeline-config",
        type=Path,
        default=DEFAULT_PIPELINE_CONFIG,
        help="Path to pipeline config JSON (default: pipeline_config.json)",
    )
    args = parser.parse_args()

    settings = SyntheticGenerationSettings(
        years=args.years,
        start_year=args.start_year,
        include_hourly=False,
        global_tolerance=0.08,
        enable_weather=True,
        enable_outliers=True,
        festival_behaviour_scale=1.1,
    )

    detections, forecasts, training, metadata = _prepare_frames(settings, seed=args.seed)
    config = load_pipeline_config(args.pipeline_config)
    runner = PipelineRunner(config)
    outputs = runner.run(forecasts, detections)
    _write_outputs(outputs["fused"], outputs["alerts"], training, metadata)

    print("Synthetic processed datasets refreshed:")
    for path in FUSED_EXPORTS + ALERT_EXPORTS + [TRAINING_EXPORT, METADATA_EXPORT]:
        print(f" - {path}")


if __name__ == "__main__":
    main()
