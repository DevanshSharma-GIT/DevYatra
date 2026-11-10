"""Tests for queue-based ingestion."""

from __future__ import annotations

import json
import queue
import time
from collections import defaultdict
from typing import DefaultDict, Dict, Optional, Sequence, Tuple

import pandas as pd

from crowd_forecast.streaming import QueueIngestionConfig, QueueIngestionEngine


class InMemoryQueueAdapter:
    def __init__(self) -> None:
        self._queues: DefaultDict[str, queue.Queue[str]] = defaultdict(queue.Queue)

    def push(self, queue_name: str, message: Dict) -> None:
        payload = json.dumps(message)
        self._queues[queue_name].put(payload)

    def pop(self, queues: Sequence[str], timeout: float) -> Optional[Tuple[str, str]]:
        if timeout <= 0:
            for name in queues:
                try:
                    payload = self._queues[name].get_nowait()
                    return name, payload
                except queue.Empty:
                    continue
            return None

        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            for name in queues:
                try:
                    payload = self._queues[name].get_nowait()
                    return name, payload
                except queue.Empty:
                    continue
            time.sleep(0.01)
        return None


def _forecast_message(key: str) -> Dict:
    return {
        "key": key,
        "records": [
            {"site": "Ambaji", "ts": "2024-01-01T00:00", "forecast": 50000, "forecast_std": 1000},
            {"site": "Dwarka", "ts": "2024-01-01T00:00", "forecast": 42000, "forecast_std": 1500},
        ],
    }


def _detection_message(key: str) -> Dict:
    return {
        "key": key,
        "records": [
            {"site": "Ambaji", "ts": "2024-01-01T00:00", "detection_count": 52000, "detection_confidence": 0.9},
            {"site": "Dwarka", "ts": "2024-01-01T00:00", "detection_count": 43000, "detection_confidence": 0.6},
        ],
    }


def test_queue_ingestion_combines_forecast_and_detection() -> None:
    adapter = InMemoryQueueAdapter()
    engine = QueueIngestionEngine(QueueIngestionConfig("forecast", "detection"), adapter)

    adapter.push("forecast", _forecast_message("batch1"))
    assert engine.poll() == []

    adapter.push("detection", _detection_message("batch1"))
    batches = engine.poll()
    assert len(batches) == 1

    batch = batches[0]
    assert batch.key == "batch1"
    pd.testing.assert_frame_equal(batch.forecasts, pd.DataFrame(_forecast_message("batch1")["records"]))
    pd.testing.assert_frame_equal(batch.detections, pd.DataFrame(_detection_message("batch1")["records"]))


def test_queue_ingestion_forecast_only_mode() -> None:
    adapter = InMemoryQueueAdapter()
    engine = QueueIngestionEngine(QueueIngestionConfig("forecast", "detection", require_pairs=False), adapter)

    adapter.push("forecast", _forecast_message("batch2"))
    batches = engine.poll()
    assert len(batches) == 1
    first_batch = batches[0]
    assert first_batch.detections.empty

    adapter.push("detection", _detection_message("batch2"))
    second_batches = engine.poll()
    assert len(second_batches) == 1
    second = second_batches[0]
    assert not second.detections.empty