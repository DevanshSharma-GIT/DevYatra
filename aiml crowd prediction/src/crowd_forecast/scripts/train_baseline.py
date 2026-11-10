"""CLI to train SARIMAX baseline models from engineered features."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from crowd_forecast import BaselineTrainer, BaselineTrainingConfig


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--features-path", type=Path, required=True, help="Path to feature matrix CSV")
    parser.add_argument("--output-dir", type=Path, default=Path("models/baseline"), help="Directory to store models")
    parser.add_argument("--horizon", type=int, default=1, help="Forecast horizon to train for (default: 1)")
    parser.add_argument(
        "--sites",
        nargs="*",
        default=None,
        help="Optional list of site names to train (defaults to all sites present)",
    )
    parser.add_argument("--maxiter", type=int, default=50, help="Maximum optimizer iterations (default: 50)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    features = pd.read_csv(args.features_path, parse_dates=["ts", "timestamp"])

    config = BaselineTrainingConfig(
        horizon=args.horizon,
        site_whitelist=args.sites,
        maxiter=args.maxiter,
    )
    trainer = BaselineTrainer(config)
    results = trainer.train(features, args.output_dir)

    summary = {
        site: info.metrics for site, info in results.items()
    }
    summary_path = args.output_dir / "metrics_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Baseline metrics written to {summary_path}")


if __name__ == "__main__":
    main()
