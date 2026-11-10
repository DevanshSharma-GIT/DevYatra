"""Real-time detection utilities built around Ultralytics YOLO models."""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple, Union

import numpy as np
from pydantic import BaseModel, Field

try:  # pragma: no cover - optional heavy dependency
    from ultralytics import YOLO
except ImportError:  # pragma: no cover - exercised when ultralytics is missing
    YOLO = None  # type: ignore


ImageLike = Union[str, Path, np.ndarray]


def _ensure_numpy(array: Any) -> np.ndarray:
    if array is None:
        return np.array([])
    if hasattr(array, "cpu"):
        array = array.cpu()
    if hasattr(array, "numpy"):
        return array.numpy()
    return np.asarray(array)


@dataclass
class BoundingBox:
    """Axis-aligned bounding box using pixel coordinates."""

    x1: float
    y1: float
    x2: float
    y2: float

    def as_tuple(self) -> Tuple[float, float, float, float]:
        return (self.x1, self.y1, self.x2, self.y2)


@dataclass
class Detection:
    """Single detection with bounding box, class name, and confidence."""

    class_name: str
    confidence: float
    bbox: BoundingBox


@dataclass
class DetectionResult:
    """Envelope for detections produced from a single inference call."""

    stream_id: Optional[str]
    captured_at: dt.datetime
    detections: List[Detection]
    frame_shape: Optional[Tuple[int, ...]] = None
    raw: Optional[Any] = field(default=None, repr=False)

    def count(self, class_names: Optional[Sequence[str]] = None) -> int:
        if class_names is None:
            return len(self.detections)
        normalized = {cls.lower() for cls in class_names}
        return sum(det.class_name.lower() in normalized for det in self.detections)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "stream_id": self.stream_id,
            "captured_at": self.captured_at.isoformat(),
            "frame_shape": self.frame_shape,
            "detections": [
                {
                    "class_name": d.class_name,
                    "confidence": d.confidence,
                    "bbox": d.bbox.as_tuple(),
                }
                for d in self.detections
            ],
        }


class DetectionConfig(BaseModel):
    model_path: str = Field("yolov8n.pt", description="Ultralytics model checkpoint path")
    conf_threshold: float = Field(0.25, ge=0.0, le=1.0)
    iou_threshold: float = Field(0.45, ge=0.0, le=1.0)
    max_detections: int = Field(300, ge=1)
    device: Optional[str] = Field(None, description="Torch device descriptor, e.g. 'cpu' or 'cuda:0'")
    person_class_names: Tuple[str, ...] = Field(("person",), description="Class labels considered as people")
    stream_id: Optional[str] = Field(None, description="Default stream identifier when none supplied")

    model_config = {
        "arbitrary_types_allowed": True,
        "protected_namespaces": (),
    }


class BaseDetectionBackend:
    """Minimal protocol the detector relies on."""

    def predict(self, image: ImageLike, **kwargs: Any) -> Iterable[Any]:  # pragma: no cover - interface method
        raise NotImplementedError


class UltralyticsBackend(BaseDetectionBackend):
    """Wrapper around ``ultralytics.YOLO`` models."""

    def __init__(self, model_path: str, device: Optional[str] = None) -> None:
        yolo_cls = globals().get("YOLO")
        if yolo_cls is None:
            raise ImportError("Ultralytics is not installed. Install 'ultralytics' to enable detection.")

        try:
            self._model = yolo_cls(model_path)
        except FileNotFoundError as exc:
            raise ImportError(f"Ultralytics weights not found at '{model_path}'. Provide a valid checkpoint path.") from exc
        self._device = device

    def predict(self, image: ImageLike, **kwargs: Any) -> Iterable[Any]:  # pragma: no cover - thin wrapper
        return self._model.predict(image, device=self._device, **kwargs)


class Detector:
    """High-level detector that produces normalized detection outputs."""

    def __init__(
        self,
        config: Optional[DetectionConfig] = None,
        backend: Optional[BaseDetectionBackend] = None,
    ) -> None:
        self.config = config or DetectionConfig()
        self._backend = backend or UltralyticsBackend(
            model_path=self.config.model_path,
            device=self.config.device,
        )

    def detect(
        self,
        image: ImageLike,
        stream_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> DetectionResult:
        metadata = metadata or {}
        captured_at = metadata.get("captured_at", dt.datetime.now(dt.UTC))
        if not isinstance(captured_at, dt.datetime):
            raise TypeError("metadata['captured_at'] must be datetime-like if provided")

        stream = stream_id or self.config.stream_id

        predictions = list(
            self._backend.predict(
                image,
                conf=self.config.conf_threshold,
                iou=self.config.iou_threshold,
                max_det=self.config.max_detections,
            )
        )

        detections: List[Detection] = []
        for pred in predictions:
            boxes = getattr(pred, "boxes", None)
            names = getattr(pred, "names", None)
            if boxes is None:
                continue

            cls_ids = _ensure_numpy(getattr(boxes, "cls", None)).astype(int)
            confs = _ensure_numpy(getattr(boxes, "conf", None))
            coords = _ensure_numpy(getattr(boxes, "xyxy", None))

            if len(coords.shape) != 2:
                continue

            for cls_id, conf, xyxy in zip(cls_ids, confs, coords):
                class_name = None
                if isinstance(names, dict):
                    class_name = names.get(int(cls_id), str(cls_id))
                elif isinstance(names, (list, tuple)) and int(cls_id) < len(names):
                    class_name = str(names[int(cls_id)])
                else:
                    class_name = str(cls_id)

                detections.append(
                    Detection(
                        class_name=class_name,
                        confidence=float(conf),
                        bbox=BoundingBox(*map(float, xyxy.tolist())),
                    )
                )

        frame_shape = None
        if isinstance(image, np.ndarray):
            frame_shape = image.shape

        return DetectionResult(
            stream_id=stream,
            captured_at=captured_at,
            detections=detections,
            frame_shape=frame_shape,
            raw=predictions,
        )


def crowd_count_from_detections(result: DetectionResult, class_names: Sequence[str] = ("person",)) -> int:
    """Convenience helper to compute people counts from a ``DetectionResult``."""

    return result.count(class_names)


__all__ = [
    "BoundingBox",
    "Detection",
    "DetectionResult",
    "DetectionConfig",
    "Detector",
    "UltralyticsBackend",
    "crowd_count_from_detections",
]