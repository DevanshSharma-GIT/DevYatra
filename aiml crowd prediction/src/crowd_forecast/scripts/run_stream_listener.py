"""Consume forecast/detection messages from a queue and run the pipeline."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from crowd_forecast import PipelineRunner, QueueIngestionConfig, QueueIngestionEngine, RedisQueueAdapter

from ._pipeline_cli import ensure_detection_frame, load_pipeline_config


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--redis-url", type=str, default="redis://localhost:6379/0", help="Redis connection URL")
    parser.add_argument("--forecast-queue", type=str, default="crowd_forecasts", help="Queue name for forecast batches")
    parser.add_argument("--detection-queue", type=str, default="crowd_detections", help="Queue name for detection batches")
    parser.add_argument("--output-dir", type=Path, required=True, help="Directory for fused/alert outputs")
    parser.add_argument("--config", type=Path, default=None, help="Optional JSON config overriding pipeline defaults")
    parser.add_argument("--allow-forecast-only", action="store_true", help="Process forecast batches even if detections lag")
    parser.add_argument("--max-batches", type=int, default=None, help="Optional cap on processed batches before exiting")
    parser.add_argument("--dry-run", action="store_true", help="Log processing decisions without writing outputs")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    pipeline_config = load_pipeline_config(args.config)
    runner = PipelineRunner(pipeline_config)

    adapter = RedisQueueAdapter(args.redis_url)
    engine = QueueIngestionEngine(
        QueueIngestionConfig(
            forecast_queue=args.forecast_queue,
            detection_queue=args.detection_queue,
            require_pairs=not args.allow_forecast_only,
        ),
        adapter,
    )

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    def process_batch(batch) -> bool:
        try:
            detections = ensure_detection_frame(batch.forecasts, batch.detections)
        except ValueError as exc:
            print(f"[skip] {batch.key}: {exc}", flush=True)
            return False

        try:
            outputs = runner.run(batch.forecasts, detections)
        except Exception as exc:  # pragma: no cover - defensive logging
            print(f"[error] {batch.key}: {exc}", flush=True)
            return False

        if args.dry_run:
            print(f"[dry-run] {batch.key}: processed but not written")
            return True

        fused_path = output_dir / f"{batch.key}_fused.csv"
        alerts_path = output_dir / f"{batch.key}_alerts.csv"
        outputs["fused"].to_csv(fused_path, index=False)
        outputs["alerts"].to_csv(alerts_path, index=False)
        print(f"[processed] {batch.key} -> {fused_path.name}, {alerts_path.name}", flush=True)
        return True

    engine.run_loop(process_batch, stop_after=args.max_batches)


if __name__ == "__main__":
    main()