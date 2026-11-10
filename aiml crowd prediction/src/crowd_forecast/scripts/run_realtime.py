"""Run the pipeline continuously by polling ingestion directories."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from crowd_forecast import IngestionConfig, IngestionEngine, PipelineRunner

from ._pipeline_cli import ensure_detection_frame, load_pipeline_config


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--forecast-dir", type=Path, required=True, help="Directory containing forecast CSV drops")
    parser.add_argument("--detection-dir", type=Path, required=True, help="Directory containing detection CSV drops")
    parser.add_argument("--output-dir", type=Path, required=True, help="Directory where fused and alert outputs are written")
    parser.add_argument("--config", type=Path, default=None, help="Optional JSON config overriding pipeline defaults")
    parser.add_argument("--state-path", type=Path, default=None, help="File recording processed batches")
    parser.add_argument("--archive-dir", type=Path, default=None, help="Directory to move processed inputs into")
    parser.add_argument("--poll-interval", type=float, default=5.0, help="Seconds between directory polls")
    parser.add_argument("--allow-forecast-only", action="store_true", help="Process forecasts even if detections are absent")
    parser.add_argument("--once", action="store_true", help="Process available batches once and exit")
    parser.add_argument("--max-batches", type=int, default=None, help="Optional cap on batches processed this session")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    pipeline_config = load_pipeline_config(args.config)
    runner = PipelineRunner(pipeline_config)

    ingestion_config = IngestionConfig(
        forecast_dir=args.forecast_dir,
        detection_dir=args.detection_dir,
        archive_dir=args.archive_dir,
        state_path=args.state_path,
        poll_interval_sec=args.poll_interval,
        require_pairs=not args.allow_forecast_only,
    )

    engine = IngestionEngine(ingestion_config)
    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    def process_batch(batch) -> bool:
        if batch.detections.empty and ingestion_config.require_pairs:
            print(f"[skip] {batch.key}: detections missing; waiting for pair", flush=True)
            return False

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

        fused_path = output_dir / f"{batch.key}_fused.csv"
        alerts_path = output_dir / f"{batch.key}_alerts.csv"
        outputs["fused"].to_csv(fused_path, index=False)
        outputs["alerts"].to_csv(alerts_path, index=False)
        print(f"[processed] {batch.key} -> {fused_path.name}, {alerts_path.name}", flush=True)
        return True

    if args.once:
        batches = engine.poll(commit=False)
        processed = 0
        for batch in batches:
            handled = process_batch(batch)
            if handled:
                engine.mark_processed(batch)
                processed += 1
                if args.max_batches is not None and processed >= args.max_batches:
                    break
    else:
        engine.run_loop(process_batch, stop_after=args.max_batches)


if __name__ == "__main__":
    main()