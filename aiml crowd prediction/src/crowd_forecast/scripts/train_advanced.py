"""CLI to train advanced ensemble models (LightGBM, XGBoost, LSTM)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from crowd_forecast import AdvancedTrainer, AdvancedTrainingConfig


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--features-path", type=Path, required=True, help="Path to feature matrix CSV")
    parser.add_argument("--output-dir", type=Path, default=Path("models/advanced"), help="Directory to store models")
    parser.add_argument("--horizon", type=int, default=1, help="Forecast horizon (default: 1)")
    parser.add_argument(
        "--sites",
        nargs="*",
        default=None,
        help="Optional list of site names to train (defaults to all sites present)",
    )
    parser.add_argument(
        "--models",
        nargs="*",
        default=["lightgbm", "xgboost", "lstm"],
        choices=["lightgbm", "xgboost", "lstm"],
        help="Subset of advanced models to train",
    )
    parser.add_argument("--disable-ensemble", action="store_true", help="Disable ensemble averaging")
    parser.add_argument("--lgbm-rounds", type=int, default=None, help="Override LightGBM boosting rounds")
    parser.add_argument("--xgb-rounds", type=int, default=None, help="Override XGBoost boosting rounds")
    parser.add_argument("--lstm-epochs", type=int, default=None, help="Override LSTM training epochs")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    features = pd.read_csv(args.features_path, parse_dates=["ts", "timestamp"])

    config = AdvancedTrainingConfig(
        horizon=args.horizon,
        site_whitelist=args.sites,
        model_types=args.models,
        enable_ensemble=not args.disable_ensemble,
    )

    if args.lgbm_rounds is not None:
        config.lightgbm_num_boost_round = args.lgbm_rounds
    if args.xgb_rounds is not None:
        config.xgboost_num_boost_round = args.xgb_rounds
    if args.lstm_epochs is not None:
        config.lstm_epochs = args.lstm_epochs

    trainer = AdvancedTrainer(config)
    results = trainer.train(features, args.output_dir)

    summary = {}
    for site, site_result in results.items():
        summary[site] = {
            "models": {name: output.metrics for name, output in site_result.model_outputs.items()},
        }
        if site_result.ensemble_metrics:
            summary[site]["ensemble"] = site_result.ensemble_metrics

    summary_path = args.output_dir / "advanced_metrics_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Advanced metrics written to {summary_path}")


if __name__ == "__main__":
    main()