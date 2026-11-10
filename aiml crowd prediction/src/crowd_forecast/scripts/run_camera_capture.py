"""Capture live camera feeds, run YOLO detection, and emit detection batches."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from crowd_forecast.capture import (  # noqa: E402
    CameraConfig,
    CaptureOrchestrator,
    CaptureSettings,
    build_detector,
    run_pipeline,
    write_batch,
)
from crowd_forecast.recording import (  # noqa: E402
    GeoIpLocationProvider,
    ObservationRecorder,
    OpenMeteoWeatherProvider,
)
from crowd_forecast.scripts._pipeline_cli import load_pipeline_config  # noqa: E402


def _load_yaml(path: Path) -> Any:
    try:
        import yaml  # type: ignore
    except ImportError as exc:  # pragma: no cover - runtime dependency
        raise RuntimeError("pyyaml is required to load camera configurations") from exc
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def load_camera_configs(path: Path) -> List[CameraConfig]:
    if not path.exists():
        raise FileNotFoundError(f"Camera config not found at {path}")

    if path.suffix.lower() in {".yaml", ".yml"}:
        payload = _load_yaml(path)
    else:
        payload = json.loads(path.read_text(encoding="utf-8"))

    if isinstance(payload, dict) and "cameras" in payload:
        camera_entries = payload["cameras"]
    elif isinstance(payload, list):
        camera_entries = payload
    else:
        raise ValueError("Camera configuration must be a list or contain a 'cameras' array")

    cameras: List[CameraConfig] = []
    for entry in camera_entries:
        latitude = entry.get("latitude")
        longitude = entry.get("longitude")
        timezone = entry.get("timezone")
        try:
            lat_value = float(latitude) if latitude is not None else None
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid latitude value for camera '{entry.get('camera_id')}': {latitude}") from exc
        try:
            lon_value = float(longitude) if longitude is not None else None
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid longitude value for camera '{entry.get('camera_id')}': {longitude}") from exc
        cameras.append(
            CameraConfig(
                camera_id=str(entry["camera_id"]),
                site=str(entry["site"]),
                source=str(entry["source"]),
                stream_id=entry.get("stream_id"),
                frame_skip=int(entry.get("frame_skip", 1)),
                description=entry.get("description"),
                latitude=lat_value,
                longitude=lon_value,
                timezone=str(timezone) if timezone is not None else None,
            )
        )
    if not cameras:
        raise ValueError("No camera definitions found in configuration")
    return cameras


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True, help="Path to camera configuration (JSON/YAML)")
    parser.add_argument("--model-path", type=str, default="yolov8n.pt", help="YOLO weights file")
    parser.add_argument("--detection-dir", type=Path, default=Path("data/incoming/detections"), help="Directory for detection CSV outputs")
    parser.add_argument("--forecast-dir", type=Path, default=Path("data/incoming/forecasts"), help="Directory for generated forecast CSVs")
    parser.add_argument("--events-dir", type=Path, default=None, help="Optional directory for raw detection events with bounding boxes")
    parser.add_argument("--metadata-dir", type=Path, default=None, help="Optional directory for batch metadata JSON")
    parser.add_argument("--processed-dir", type=Path, default=None, help="Optional directory to write fused & alert outputs per batch")
    parser.add_argument("--pipeline-config", type=Path, default=None, help="Optional pipeline config JSON for fusion/alerting")
    parser.add_argument("--record-csv", type=Path, default=None, help="Optional CSV to append per-camera observations every batch")
    parser.add_argument("--record-no-weather", action="store_true", help="Disable weather enrichment when recording observations")
    parser.add_argument("--record-weather-timeout", type=float, default=10.0, help="Timeout (seconds) for weather API calls")
    parser.add_argument(
        "--record-weather-cache-minutes",
        type=float,
        default=5.0,
        help="Minutes to reuse cached weather observations before hitting the API again",
    )
    parser.add_argument(
        "--record-disable-auto-location",
        action="store_true",
        help="Skip automatic GeoIP lookup for latitude/longitude when the camera config omits them",
    )
    parser.add_argument(
        "--record-location-timeout",
        type=float,
        default=5.0,
        help="Timeout (seconds) for the GeoIP lookup when auto-location is enabled",
    )
    parser.add_argument("--interval-sec", type=float, default=10.0, help="Capture interval length in seconds")
    parser.add_argument("--sample-rate", type=int, default=1, help="Only run detection on every Nth frame")
    parser.add_argument("--warmup-sec", type=float, default=1.0, help="Seconds to discard frames after opening camera")
    parser.add_argument("--max-batches", type=int, default=None, help="Stop after emitting this many batches")
    parser.add_argument("--sleep-between", type=float, default=0.0, help="Seconds to sleep between batches")
    parser.add_argument("--smoothing-alpha", type=float, default=0.6, help="Smoothing factor for on-the-fly forecasts")
    parser.add_argument("--forecast-window", type=int, default=12, help="Number of observations to retain for forecast std")
    parser.add_argument("--simulate", action="store_true", help="Use synthetic detections instead of live cameras")
    parser.add_argument("--simulate-seed", type=int, default=None, help="Seed for deterministic simulation")
    parser.add_argument("--device", type=str, default=None, help="Torch device string for YOLO")
    parser.add_argument("--conf", type=float, default=0.25, help="YOLO confidence threshold override")
    parser.add_argument("--iou", type=float, default=0.45, help="YOLO IoU threshold override")
    parser.add_argument("--max-det", type=int, default=300, help="YOLO maximum detections per frame")
    parser.add_argument("--preview", action="store_true", help="Display live preview window(s) with bounding boxes while capturing")
    parser.add_argument("--frame-interval-sec", type=float, default=0.0, help="Minimum seconds between detection samples per camera")
    return parser.parse_args()


def _detector_factory(model_path: str, overrides: Dict[str, Any]) -> Any:
    return build_detector(model_path, overrides)


def main() -> None:
    args = parse_args()

    cameras = load_camera_configs(args.config)
    settings = CaptureSettings(
        interval_sec=args.interval_sec,
        warmup_sec=args.warmup_sec,
        detection_sample_rate=max(1, args.sample_rate),
        max_batches=args.max_batches,
        sleep_between_batches=args.sleep_between,
        smoothing_alpha=args.smoothing_alpha,
        forecast_window=args.forecast_window,
        frame_interval_sec=max(0.0, args.frame_interval_sec),
    )

    detection_overrides = {
        "conf_threshold": args.conf,
        "iou_threshold": args.iou,
        "max_detections": args.max_det,
        "device": args.device,
    }

    forecast_dir: Optional[Path] = args.forecast_dir
    if forecast_dir is not None and str(forecast_dir).lower() in {"none", ""}:
        forecast_dir = None

    metadata_dir: Optional[Path] = args.metadata_dir
    if metadata_dir is not None and str(metadata_dir).lower() in {"none", ""}:
        metadata_dir = None

    events_dir: Optional[Path] = args.events_dir
    if events_dir is not None and str(events_dir).lower() in {"none", ""}:
        events_dir = None

    processed_dir: Optional[Path] = args.processed_dir
    if processed_dir is not None and str(processed_dir).lower() in {"none", ""}:
        processed_dir = None

    recorder: Optional[ObservationRecorder] = None
    if args.record_csv is not None and str(args.record_csv).lower() not in {"none", ""}:
        weather_provider = None if args.record_no_weather else OpenMeteoWeatherProvider(timeout=args.record_weather_timeout)
        location_provider = None
        if not args.record_disable_auto_location:
            location_provider = GeoIpLocationProvider(timeout=args.record_location_timeout)
        recorder = ObservationRecorder(
            output_path=args.record_csv,
            weather_provider=weather_provider,
            cache_minutes=args.record_weather_cache_minutes,
            location_provider=location_provider,
        )

    orchestrator = CaptureOrchestrator(
        cameras=cameras,
        settings=settings,
        detector_factory=_detector_factory,
        model_path=args.model_path,
        detection_config_overrides=detection_overrides,
        simulate=args.simulate,
        simulate_seed=args.simulate_seed,
        show_preview=args.preview,
    )

    pipeline_config = None
    if processed_dir is not None:
        pipeline_config = load_pipeline_config(args.pipeline_config)

    processed = 0
    try:
        while True:
            try:
                batch = orchestrator.collect_batch()
            except RuntimeError as exc:
                message = str(exc)
                if "No camera snapshots collected" in message:
                    print(f"[camera] {message}")
                    break
                raise
            detection_path, forecast_path, events_path = write_batch(
                batch,
                detection_dir=args.detection_dir,
                forecast_dir=forecast_dir,
                metadata_dir=metadata_dir,
                events_dir=events_dir,
            )
            print(f"[camera] wrote detections -> {detection_path}")
            if forecast_path:
                print(f"[camera] wrote forecasts -> {forecast_path}")
            if events_path:
                print(f"[camera] wrote raw events -> {events_path}")

            if recorder is not None:
                recorder.record_batch(batch)

            if processed_dir is not None:
                fused_path, alerts_path = run_pipeline(batch, pipeline_config, processed_dir)
                print(f"[pipeline] fused -> {fused_path.name}, alerts -> {alerts_path.name}")

            processed += 1
            if args.max_batches is not None and processed >= args.max_batches:
                break
            if args.sleep_between:
                time.sleep(args.sleep_between)
    except KeyboardInterrupt:
        print("\n[camera] capture interrupted by user; shutting down previews...")
    finally:
        orchestrator.close()


if __name__ == "__main__":
    main()
