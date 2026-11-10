"""Live camera capture utilities for YOLO-based crowd detection."""

from __future__ import annotations

import datetime as dt
import json
import logging
import math
import random
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd

from .detection import DetectionConfig, DetectionResult, Detector, crowd_count_from_detections
from .pipeline import PipelineConfig, PipelineRunner


logger = logging.getLogger(__name__)


@dataclass
class CameraConfig:
    """Configuration for a single camera stream."""

    camera_id: str
    site: str
    source: str
    stream_id: Optional[str] = None
    frame_skip: int = 1
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = None


@dataclass
class CaptureSettings:
    """Global settings for camera capture sessions."""

    interval_sec: float = 10.0
    warmup_sec: float = 1.0
    detection_sample_rate: int = 1
    max_batches: Optional[int] = None
    sleep_between_batches: float = 0.0
    smoothing_alpha: float = 0.6
    forecast_window: int = 12
    person_classes: Tuple[str, ...] = ("person",)
    frame_interval_sec: float = 0.0


@dataclass
class DetectionSnapshot:
    """Aggregated detection information for a camera within one interval."""

    camera: CameraConfig
    timestamp: dt.datetime
    counts: List[int] = field(default_factory=list)
    confidences: List[float] = field(default_factory=list)
    events: List[Dict[str, Any]] = field(default_factory=list)

    def to_record(self) -> Dict[str, Any]:
        count_value = int(round(float(np.mean(self.counts)) if self.counts else 0.0))
        confidence_value = float(np.mean(self.confidences)) if self.confidences else 0.0
        return {
            "camera_id": self.camera.camera_id,
            "site": self.camera.site,
            "stream_id": self.camera.stream_id or self.camera.camera_id,
            "ts": self.timestamp.isoformat(),
            "detection_count": count_value,
            "detection_confidence": confidence_value,
            "frame_samples": len(self.counts),
            "event_count": len(self.events),
        }


class SimpleSiteForecaster:
    """Lightweight exponential-smoothing forecaster for quick projections."""

    def __init__(self, alpha: float = 0.6, window: int = 12) -> None:
        self.alpha = alpha
        self.window = window
        self._history: List[float] = []
        self._forecast: Optional[float] = None

    def update(self, observation: float) -> Tuple[float, float]:
        if math.isnan(observation):
            observation = 0.0
        if self._forecast is None:
            self._forecast = observation
        else:
            self._forecast = self.alpha * observation + (1 - self.alpha) * self._forecast
        self._history.append(observation)
        if len(self._history) > self.window:
            self._history.pop(0)
        std = float(np.std(self._history, ddof=1)) if len(self._history) > 1 else 0.0
        return float(self._forecast), std


class CameraUnavailableError(RuntimeError):
    """Raised when a configured camera cannot be opened."""


class CameraCollector:
    """Capture loop that acquires frames and runs YOLO detections."""

    def __init__(
        self,
        camera: CameraConfig,
        detector: Detector,
        settings: CaptureSettings,
        show_preview: bool = False,
        preview_window: Optional[str] = None,
    ) -> None:
        self.camera = camera
        self.detector = detector
        self.settings = settings
        self._capture = None
        self.show_preview = show_preview
        self.preview_window = preview_window or f"preview:{self.camera.camera_id}"
        self._cv2 = None

    def _ensure_capture(self) -> Any:
        if self._capture is not None:
            return self._capture

        try:
            import cv2  # type: ignore
        except ImportError as exc:  # pragma: no cover - runtime dependency only
            raise RuntimeError("opencv-python is required for live camera capture") from exc

        self._cv2 = cv2

        source = self.camera.source
        if source.isdigit():
            capture = cv2.VideoCapture(int(source))
        else:
            capture = cv2.VideoCapture(source)
        if not capture.isOpened():
            raise CameraUnavailableError(f"Failed to open camera source '{source}'")

        # Warm-up frames
        warmup_end = time.time() + self.settings.warmup_sec
        while time.time() < warmup_end:
            capture.read()
        self._capture = capture
        return capture

    def collect(self, interval_sec: float) -> DetectionSnapshot:
        capture = self._ensure_capture()
        end_time = time.time() + interval_sec
        counts: List[int] = []
        confidences: List[float] = []
        events: List[Dict[str, Any]] = []
        frame_index = 0

        effective_skip = max(1, self.settings.detection_sample_rate) * max(1, self.camera.frame_skip)
        person_classes = {cls.lower() for cls in self.settings.person_classes}
        frame_interval = max(0.0, float(self.settings.frame_interval_sec))
        next_sample_time = time.time() if frame_interval <= 0 else time.time() - frame_interval

        while time.time() < end_time:
            ret, frame = capture.read()
            if not ret:
                break
            now = time.time()

            if frame_interval > 0 and now < next_sample_time:
                frame_index += 1
                remaining = next_sample_time - now
                if remaining > 0.002:
                    time.sleep(min(remaining, frame_interval))
                continue
            if frame_index % effective_skip != 0:
                frame_index += 1
                continue

            current_index = frame_index
            result = self.detector.detect(frame, stream_id=self.camera.stream_id)
            count = crowd_count_from_detections(result, self.settings.person_classes)
            counts.append(count)
            confidences.append(_average_confidence(result))

            if frame_interval > 0:
                next_sample_time = now + frame_interval

            if self.show_preview:
                self._render_preview(frame, result, count)

            frame_timestamp = result.captured_at if isinstance(result.captured_at, dt.datetime) else dt.datetime.now(dt.UTC)
            frame_shape = result.frame_shape or getattr(frame, "shape", None)
            frame_height = frame_shape[0] if frame_shape is not None and len(frame_shape) > 0 else None
            frame_width = frame_shape[1] if frame_shape is not None and len(frame_shape) > 1 else None

            for det in result.detections:
                bbox = det.bbox.as_tuple()
                events.append(
                    {
                        "camera_id": self.camera.camera_id,
                        "site": self.camera.site,
                        "stream_id": self.camera.stream_id or self.camera.camera_id,
                        "ts": frame_timestamp.isoformat(),
                        "frame_index": current_index,
                        "class_name": det.class_name,
                        "confidence": float(det.confidence),
                        "bbox_x1": float(bbox[0]),
                        "bbox_y1": float(bbox[1]),
                        "bbox_x2": float(bbox[2]),
                        "bbox_y2": float(bbox[3]),
                        "frame_height": frame_height,
                        "frame_width": frame_width,
                        "is_person": det.class_name.lower() in person_classes,
                    }
                )

            frame_index += 1

        return DetectionSnapshot(
            camera=self.camera,
            timestamp=dt.datetime.now(dt.UTC),
            counts=counts,
            confidences=confidences,
            events=events,
        )

    def close(self) -> None:
        if self._capture is None:
            return
        try:
            self._capture.release()
        finally:
            self._capture = None
        if self.show_preview and self._cv2 is not None:
            try:  # pragma: no cover - depends on GUI availability
                self._cv2.destroyWindow(self.preview_window)
            except Exception:
                pass
            finally:
                if hasattr(self._cv2, "waitKey"):
                    self._cv2.waitKey(1)
        self._cv2 = None

    def _render_preview(self, frame: Any, result: DetectionResult, count: int) -> None:
        if not self.show_preview or self._cv2 is None:
            return

        cv2 = self._cv2
        rendered = frame
        raw_predictions = result.raw if isinstance(result.raw, (list, tuple)) else []
        if raw_predictions:
            try:  # pragma: no cover - depends on ultralytics internals
                rendered = raw_predictions[0].plot()
            except Exception:
                rendered = frame

        try:
            cv2.putText(
                rendered,
                f"{self.camera.camera_id} | people: {count}",
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 0),
                2,
                cv2.LINE_AA,
            )
        except Exception:
            pass

        cv2.imshow(self.preview_window, rendered)
        key = cv2.waitKey(1) & 0xFF
        if key in (27, ord("q")):
            raise KeyboardInterrupt("Preview interrupted by user")


def _average_confidence(result: DetectionResult) -> float:
    if not result.detections:
        return 0.0
    return float(np.mean([det.confidence for det in result.detections]))


class SimulationCollector:
    """Synthetic collector used for dry-run scenarios and tests."""

    def __init__(self, camera: CameraConfig, seed: Optional[int] = None) -> None:
        self.camera = camera
        self.random = random.Random(seed)

    def collect(self, interval_sec: float) -> DetectionSnapshot:  # pragma: no cover - simple stochastic helper
        base = self.random.uniform(20, 200)
        frame_count = max(1, int(max(interval_sec, 1)))
        noise = [max(0, int(self.random.gauss(base, base * 0.2))) for _ in range(frame_count)]
        confidences = [self.random.uniform(0.6, 0.95) for _ in noise]

        events: List[Dict[str, Any]] = []
        start_ts = dt.datetime.now(dt.UTC)
        frame_height, frame_width = 720, 1280

        for frame_idx, detections in enumerate(noise):
            frame_ts = (start_ts + dt.timedelta(seconds=frame_idx * 0.5)).isoformat()
            for _ in range(detections):
                w = self.random.uniform(0.05, 0.25)
                h = self.random.uniform(0.1, 0.35)
                x1 = self.random.uniform(0.0, 1.0 - w) * frame_width
                y1 = self.random.uniform(0.0, 1.0 - h) * frame_height
                x2 = x1 + w * frame_width
                y2 = y1 + h * frame_height
                events.append(
                    {
                        "camera_id": self.camera.camera_id,
                        "site": self.camera.site,
                        "stream_id": self.camera.stream_id or self.camera.camera_id,
                        "ts": frame_ts,
                        "frame_index": frame_idx,
                        "class_name": "person",
                        "confidence": float(self.random.uniform(0.6, 0.99)),
                        "bbox_x1": float(x1),
                        "bbox_y1": float(y1),
                        "bbox_x2": float(x2),
                        "bbox_y2": float(y2),
                        "frame_height": frame_height,
                        "frame_width": frame_width,
                        "is_person": True,
                    }
                )

        return DetectionSnapshot(
            camera=self.camera,
            timestamp=start_ts,
            counts=noise,
            confidences=confidences,
            events=events,
        )

    def close(self) -> None:  # pragma: no cover - simulation requires no cleanup
        return


def build_detector(model_path: str, config_overrides: Optional[Dict[str, Any]] = None) -> Detector:
    overrides = config_overrides or {}
    config = DetectionConfig(model_path=model_path, **overrides)
    return Detector(config=config)


@dataclass
class BatchOutput:
    key: str
    detections: pd.DataFrame
    forecasts: pd.DataFrame
    events: Optional[pd.DataFrame] = None
    per_camera: Optional[pd.DataFrame] = None
    snapshots: Optional[List[DetectionSnapshot]] = None


class CaptureOrchestrator:
    """Coordinates multiple camera collectors, aggregation, and optional pipeline execution."""

    def __init__(
        self,
        cameras: Sequence[CameraConfig],
        settings: CaptureSettings,
        detector_factory,
        model_path: str,
        detection_config_overrides: Optional[Dict[str, Any]] = None,
        simulate: bool = False,
        simulate_seed: Optional[int] = None,
        show_preview: bool = False,
    ) -> None:
        self.cameras = list(cameras)
        self.settings = settings
        self.detector_factory = detector_factory
        self.model_path = model_path
        self.detection_config_overrides = detection_config_overrides or {}
        self.simulate = simulate
        self.simulate_seed = simulate_seed
        self._collectors: List[Any] = []
        self._forecasters: Dict[str, SimpleSiteForecaster] = {}
        self.show_preview = show_preview

    def _create_collectors(self) -> None:
        if self._collectors:
            return
        for idx, camera in enumerate(self.cameras):
            if camera.site not in self._forecasters:
                self._forecasters[camera.site] = SimpleSiteForecaster(
                    alpha=self.settings.smoothing_alpha,
                    window=self.settings.forecast_window,
                )
            if self.simulate:
                collector = SimulationCollector(camera, seed=(self.simulate_seed or 0) + idx)
            else:
                detector = self.detector_factory(self.model_path, self.detection_config_overrides)
                collector = CameraCollector(
                    camera,
                    detector,
                    self.settings,
                    show_preview=self.show_preview,
                )
            self._collectors.append(collector)

    def close(self) -> None:
        for collector in self._collectors:
            close = getattr(collector, "close", None)
            if close:
                close()
        self._collectors = []
        if self.show_preview:
            try:  # pragma: no cover - depends on GUI availability
                import cv2  # type: ignore

                cv2.destroyAllWindows()
                cv2.waitKey(1)
            except Exception:
                pass

    def collect_batch(self) -> BatchOutput:
        self._create_collectors()

        snapshots: List[DetectionSnapshot] = []
        events_records: List[Dict[str, Any]] = []
        camera_records: List[Dict[str, Any]] = []
        skipped_cameras: List[str] = []
        for collector in self._collectors:
            try:
                snapshot = collector.collect(self.settings.interval_sec)
            except CameraUnavailableError as exc:
                camera_id = getattr(collector, "camera", None)
                camera_code = camera_id.camera_id if camera_id else "unknown"
                skipped_cameras.append(camera_code)
                logger.warning("[capture] skipping camera %s: %s", camera_code, exc)
                continue
            snapshots.append(snapshot)
            events_records.extend(snapshot.events)
            camera_records.append(snapshot.to_record())

        if not snapshots:
            skipped_msg = f" (skipped: {', '.join(skipped_cameras)})" if skipped_cameras else ""
            raise RuntimeError(
                "No camera snapshots collected; ensure cameras are configured correctly" + skipped_msg
            )

        records = []
        forecast_records = []
        timestamp = dt.datetime.now(dt.UTC).replace(microsecond=0)
        key = f"camera_{timestamp.strftime('%Y%m%d_%H%M%S')}"

        site_buckets: Dict[str, Dict[str, Any]] = {}
        for snapshot in snapshots:
            per_camera = snapshot.to_record()
            site_bucket = site_buckets.setdefault(
                per_camera["site"],
                {
                    "counts": [],
                    "confidences": [],
                    "camera_ids": [],
                    "stream_ids": [],
                },
            )
            site_bucket["counts"].append(per_camera["detection_count"])
            site_bucket["confidences"].append(per_camera["detection_confidence"])
            site_bucket["camera_ids"].append(per_camera["camera_id"])
            site_bucket["stream_ids"].append(per_camera["stream_id"])

        for site, bucket in site_buckets.items():
            counts = bucket["counts"]
            confidences = bucket["confidences"]
            agg_count = int(round(float(np.mean(counts)) if counts else 0.0))
            agg_conf = float(np.mean(confidences)) if confidences else 0.0

            forecaster = self._forecasters[site]
            forecast_value, forecast_std = forecaster.update(agg_count)

            records.append(
                {
                    "site": site,
                    "ts": timestamp.isoformat(),
                    "detection_count": agg_count,
                    "detection_confidence": agg_conf,
                    "camera_ids": ",".join(bucket["camera_ids"]),
                    "stream_ids": ",".join(bucket["stream_ids"]),
                }
            )

            forecast_records.append(
                {
                    "site": site,
                    "ts": timestamp.isoformat(),
                    "forecast": float(forecast_value),
                    "forecast_std": float(forecast_std),
                }
            )

        detection_df = pd.DataFrame.from_records(records)
        forecast_df = pd.DataFrame.from_records(forecast_records)
        events_df = pd.DataFrame.from_records(events_records) if events_records else pd.DataFrame()
        per_camera_df = pd.DataFrame.from_records(camera_records)
        return BatchOutput(
            key=key,
            detections=detection_df,
            forecasts=forecast_df,
            events=events_df,
            per_camera=per_camera_df,
            snapshots=snapshots,
        )


def write_batch(
    batch: BatchOutput,
    detection_dir: Path,
    forecast_dir: Optional[Path] = None,
    metadata_dir: Optional[Path] = None,
    events_dir: Optional[Path] = None,
) -> Tuple[Path, Optional[Path], Optional[Path]]:
    detection_dir.mkdir(parents=True, exist_ok=True)
    detection_path = detection_dir / f"{batch.key}.csv"
    batch.detections.to_csv(detection_path, index=False)

    forecast_path: Optional[Path] = None
    if forecast_dir is not None:
        forecast_dir.mkdir(parents=True, exist_ok=True)
        forecast_path = forecast_dir / f"{batch.key}.csv"
        batch.forecasts.to_csv(forecast_path, index=False)

    events_path: Optional[Path] = None
    if events_dir is not None and batch.events is not None and not batch.events.empty:
        events_dir.mkdir(parents=True, exist_ok=True)
        events_path = events_dir / f"{batch.key}_events.csv"
        batch.events.to_csv(events_path, index=False)

    if metadata_dir is not None:
        metadata_dir.mkdir(parents=True, exist_ok=True)
        meta = {
            "key": batch.key,
            "created_at": dt.datetime.now(dt.UTC).isoformat(),
            "detections_path": str(detection_path),
            "forecast_path": str(forecast_path) if forecast_path else None,
            "events_path": str(events_path) if events_path else None,
            "rows": len(batch.detections),
            "event_rows": int(len(batch.events)) if batch.events is not None else 0,
        }
        (metadata_dir / f"{batch.key}.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    return detection_path, forecast_path, events_path


def run_pipeline(
    batch: BatchOutput,
    pipeline_config: Optional[PipelineConfig],
    processed_dir: Path,
) -> Tuple[Path, Path]:
    runner = PipelineRunner(pipeline_config)
    outputs = runner.run(batch.forecasts, batch.detections)
    processed_dir.mkdir(parents=True, exist_ok=True)
    fused_path = processed_dir / f"{batch.key}_fused.csv"
    alerts_path = processed_dir / f"{batch.key}_alerts.csv"
    outputs["fused"].to_csv(fused_path, index=False)
    outputs["alerts"].to_csv(alerts_path, index=False)
    return fused_path, alerts_path


__all__ = [
    "CameraConfig",
    "CaptureSettings",
    "CaptureOrchestrator",
    "BatchOutput",
    "write_batch",
    "run_pipeline",
    "build_detector",
    "SimpleSiteForecaster",
    "CameraUnavailableError",
]
