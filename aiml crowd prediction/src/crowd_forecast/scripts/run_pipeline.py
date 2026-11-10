"""CLI to execute the full fusion + alerting pipeline."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from crowd_forecast import PipelineConfig, PipelineRunner

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ._pipeline_cli import load_pipeline_config


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--forecasts", required=True, type=Path, help="CSV containing forecasts")
    parser.add_argument("--detections", required=True, type=Path, help="CSV containing detections")
    parser.add_argument("--fused-output", required=True, type=Path, help="Output CSV for fused results")
    parser.add_argument("--alerts-output", required=True, type=Path, help="Output CSV for alerts")
    parser.add_argument("--config", type=Path, default=None, help="Optional JSON config overriding defaults")
    return parser.parse_args()


def load_config(path: Path | None) -> PipelineConfig:
    return load_pipeline_config(path)


def main() -> None:
    args = parse_args()
    config = load_config(args.config)
    runner = PipelineRunner(config)
    runner.run_from_files(args.forecasts, args.detections, args.fused_output, args.alerts_output)
    print(f"Pipeline outputs written to {args.fused_output} and {args.alerts_output}")


if __name__ == "__main__":
    main()