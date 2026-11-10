"""Message-queue driven ingestion for streaming pipeline execution."""

from __future__ import annotations

import json
import math
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Protocol, Sequence, Tuple

import pandas as pd

from .ingestion import IngestionBatch


class QueueAdapter(Protocol):
    """Abstracts queue backends such as Redis or RabbitMQ."""

    def pop(self, queues: Sequence[str], timeout: float) -> Optional[Tuple[str, str]]:
        """Return the next message from the named queues."""


@dataclass
class QueueIngestionConfig:
    forecast_queue: str
    detection_queue: str
    require_pairs: bool = True
    poll_interval_sec: float = 1.0


@dataclass
class QueueMessage:
    key: str
    records: pd.DataFrame

    @classmethod
    def from_json(cls, payload: str) -> "QueueMessage":
        data = json.loads(payload)
        if "key" not in data or "records" not in data:
            raise ValueError("Queue payload must include 'key' and 'records'")
        frame = pd.DataFrame(data["records"])
        return cls(key=str(data["key"]), records=frame)


class QueueIngestionEngine:
    """Combines forecast and detection queue messages into ingestion batches."""

    def __init__(self, config: QueueIngestionConfig, adapter: QueueAdapter) -> None:
        self.config = config
        self.adapter = adapter
        self._pending_forecasts: Dict[str, Tuple[pd.DataFrame, bool]] = {}
        self._pending_detections: Dict[str, pd.DataFrame] = {}

    def _handle_forecast(self, message: QueueMessage) -> List[IngestionBatch]:
        batches: List[IngestionBatch] = []
        self._pending_forecasts[message.key] = (message.records, False)
        batches.extend(self._maybe_emit_batch(message.key))
        return batches

    def _handle_detection(self, message: QueueMessage) -> List[IngestionBatch]:
        self._pending_detections[message.key] = message.records
        return self._maybe_emit_batch(message.key)

    def _maybe_emit_batch(self, key: str) -> List[IngestionBatch]:
        forecasts_entry = self._pending_forecasts.get(key)
        if forecasts_entry is None:
            return []

        forecasts_df, only_emitted = forecasts_entry
        if key in self._pending_detections:
            detections_df = self._pending_detections.pop(key)
            self._pending_forecasts.pop(key, None)
            return [IngestionBatch(key, None, None, forecasts_df, detections_df)]

        if not self.config.require_pairs and not only_emitted:
            # Emit forecast-only batch and remember that we've already done so.
            self._pending_forecasts[key] = (forecasts_df, True)
            return [IngestionBatch(key, None, None, forecasts_df, pd.DataFrame())]

        return []

    def poll(self) -> List[IngestionBatch]:
        batches: List[IngestionBatch] = []
        result = self.adapter.pop([self.config.forecast_queue, self.config.detection_queue], self.config.poll_interval_sec)
        if result is None:
            return batches

        queue_name, payload = result
        message = QueueMessage.from_json(payload)
        if queue_name == self.config.forecast_queue:
            batches.extend(self._handle_forecast(message))
        elif queue_name == self.config.detection_queue:
            batches.extend(self._handle_detection(message))
        else:
            raise ValueError(f"Unexpected queue name: {queue_name}")

        # Drain any additional messages without blocking.
        while True:
            next_message = self.adapter.pop([self.config.forecast_queue, self.config.detection_queue], 0)
            if next_message is None:
                break
            queue_name, payload = next_message
            message = QueueMessage.from_json(payload)
            if queue_name == self.config.forecast_queue:
                batches.extend(self._handle_forecast(message))
            elif queue_name == self.config.detection_queue:
                batches.extend(self._handle_detection(message))
            else:
                raise ValueError(f"Unexpected queue name: {queue_name}")

        return batches

    def run_loop(self, callback, stop_after: Optional[int] = None) -> None:
        processed = 0
        while True:
            if stop_after is not None and processed >= stop_after:
                return
            batches = self.poll()
            if not batches:
                time.sleep(self.config.poll_interval_sec)
                continue
            for batch in batches:
                handled = callback(batch)
                if handled:
                    processed += 1


class RedisQueueAdapter:
    """Queue adapter backed by Redis lists."""

    def __init__(self, url: str) -> None:
        try:
            import redis  # type: ignore
        except ImportError as exc:  # pragma: no cover - runtime dependency
            raise RuntimeError("redis package is required for RedisQueueAdapter") from exc

        self._client = redis.from_url(url)

    def pop(self, queues: Sequence[str], timeout: float) -> Optional[Tuple[str, str]]:
        if timeout <= 0:
            for queue in queues:
                value = self._client.lpop(queue)
                if value is not None:
                    return queue, self._decode(value)
            return None

        wait = max(int(math.ceil(timeout)), 1)
        result = self._client.blpop(list(queues), timeout=wait)
        if result is None:
            return None
        queue_name, payload = result
        queue_str = queue_name.decode() if isinstance(queue_name, bytes) else queue_name
        return queue_str, self._decode(payload)

    @staticmethod
    def _decode(value: bytes | str) -> str:
        return value.decode() if isinstance(value, bytes) else value


__all__ = [
    "QueueAdapter",
    "QueueIngestionConfig",
    "QueueIngestionEngine",
    "QueueMessage",
    "RedisQueueAdapter",
]