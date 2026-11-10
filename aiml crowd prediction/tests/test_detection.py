"""Tests for detection utilities without requiring real YOLO weights."""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Any, Iterable, List

import numpy as np

from crowd_forecast.detection import (
    Detection,
    DetectionConfig,
    DetectionResult,
    Detector,
    UltralyticsBackend,
    crowd_count_from_detections,
)


@dataclass
class _MockBoxes:
    cls: np.ndarray
    conf: np.ndarray
    xyxy: np.ndarray


@dataclass
class _MockPrediction:
    boxes: _MockBoxes
    names: dict


class _MockBackend:
    def __init__(self, predictions: Iterable[_MockPrediction]) -> None:
        self._predictions = list(predictions)
        self.calls: List[Any] = []

    def predict(self, image, **kwargs):
        self.calls.append({"image": image, "kwargs": kwargs})
        return self._predictions


def test_detector_normalizes_predictions():
    predictions = [
        _MockPrediction(
            boxes=_MockBoxes(
                cls=np.array([0, 0, 1]),
                conf=np.array([0.9, 0.8, 0.4]),
                xyxy=np.array([[0, 0, 10, 10], [5, 5, 15, 20], [2, 4, 9, 9]]),
            ),
            names={0: "person", 1: "vehicle"},
        )
    ]

    detector = Detector(config=DetectionConfig(stream_id="cam-1"), backend=_MockBackend(predictions))
    frame = np.zeros((720, 1280, 3), dtype=np.uint8)
    result = detector.detect(frame, metadata={"captured_at": dt.datetime(2024, 1, 1, tzinfo=dt.UTC)})

    assert result.stream_id == "cam-1"
    assert result.frame_shape == frame.shape
    assert len(result.detections) == 3
    assert result.detections[0].class_name == "person"
    assert result.detections[1].confidence == 0.8
    assert result.detections[2].bbox.as_tuple() == (2.0, 4.0, 9.0, 9.0)


def test_crowd_count_helper_filters_by_class():
    detections = [
        Detection(class_name="person", confidence=0.9, bbox=None),  # type: ignore[arg-type]
        Detection(class_name="vehicle", confidence=0.3, bbox=None),  # type: ignore[arg-type]
    ]
    result = DetectionResult(stream_id=None, captured_at=dt.datetime.now(dt.UTC), detections=detections)
    assert crowd_count_from_detections(result) == 1


def test_detector_raises_without_captured_at_type():
    detector = Detector(config=DetectionConfig(), backend=_MockBackend([]))
    try:
        detector.detect(np.zeros((10, 10, 3), dtype=np.uint8), metadata={"captured_at": "not a datetime"})
    except TypeError as exc:
        assert "captured_at" in str(exc)
    else:  # pragma: no cover - we expect TypeError
        raise AssertionError("TypeError not raised")


def test_ultralytics_backend_requires_dependency(monkeypatch):
    monkeypatch.setitem(globals(), "YOLO", None)
    try:
        UltralyticsBackend(model_path="dummy.pt")
    except ImportError as exc:
        assert "Ultralytics" in str(exc)
    else:  # pragma: no cover - backend must fail without dependency
        raise AssertionError("UltralyticsBackend should raise ImportError when ultralytics is missing")