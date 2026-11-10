"""CLI to fuse forecast outputs with detection counts."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from crowd_forecast import FusionConfig, FusionEngine, merge_forecast_detection


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--forecasts", required=True, type=Path, help="CSV with forecast columns (site, ts, forecast[, forecast_std])")
    parser.add_argument("--detections", required=True, type=Path, help="CSV with detection columns (site, ts, detection_count[, detection_confidence])")
    parser.add_argument("--output", required=True, type=Path, help="Destination CSV for fused output")
    parser.add_argument("--detection-weight", type=float, default=0.6, help="Base weight for detection signal")
    parser.add_argument("--forecast-weight", type=float, default=0.4, help="Base weight for forecast signal")
    parser.add_argument("--smoothing-window", type=int, default=3, help="Rolling window for smoothing fused estimates")
    parser.add_argument("--clip-min", type=float, default=0.0, help="Minimum fused value (set negative for no clipping)")
    parser.add_argument("--clip-max", type=float, default=None, help="Maximum fused value")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    forecasts = pd.read_csv(args.forecasts)
    detections = pd.read_csv(args.detections)

    config = FusionConfig(
        detection_weight=args.detection_weight,
        forecast_weight=args.forecast_weight,
        smoothing_window=args.smoothing_window,
        clip_min=args.clip_min,
        clip_max=args.clip_max,
    )

    merged = merge_forecast_detection(forecasts, detections)
    engine = FusionEngine(config)
    fused = engine.fuse(merged)
    fused.to_csv(args.output, index=False)
    print(f"Fused signals written to {args.output}")


if __name__ == "__main__":
    main()