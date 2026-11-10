"""CLI to generate alerts from fused estimates."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from crowd_forecast import AlertConfig, AlertEngine


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fused", required=True, type=Path, help="CSV containing fused estimates (site, ts, fused_estimate, ...)")
    parser.add_argument("--output", required=True, type=Path, help="Destination CSV for alert annotations")
    parser.add_argument("--default-capacity", type=float, default=None, help="Fallback capacity when site-specific values are absent")
    parser.add_argument("--site-capacity", type=Path, default=None, help="JSON file mapping site -> capacity")
    parser.add_argument("--warning-ratio", type=float, default=0.75, help="Occupancy ratio for warning level")
    parser.add_argument("--critical-ratio", type=float, default=0.9, help="Occupancy ratio for critical level")
    parser.add_argument("--sustained-window", type=int, default=3, help="Rolling window length for sustained thresholds")
    parser.add_argument("--detection-spike", type=float, default=0.25, help="Detection spike threshold (fraction above warning ratio)")
    return parser.parse_args()


def load_site_capacity(path: Optional[Path]) -> dict:
    if path is None:
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("site-capacity file must contain a JSON object")
    return {str(k): float(v) for k, v in data.items()}


def main() -> None:
    args = parse_args()
    fused = pd.read_csv(args.fused)
    capacities = load_site_capacity(args.site_capacity)

    config = AlertConfig(
        default_capacity=args.default_capacity,
        site_capacity=capacities,
        warning_ratio=args.warning_ratio,
        critical_ratio=args.critical_ratio,
        sustained_window=args.sustained_window,
        detection_spike_ratio=args.detection_spike,
    )

    engine = AlertEngine(config)
    annotated = engine.generate_alerts(fused)
    annotated.to_csv(args.output, index=False)
    print(f"Alerts written to {args.output}")


if __name__ == "__main__":
    main()