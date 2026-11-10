"""Data ingestion utilities for feeding the pipeline in near-real time."""

from __future__ import annotations

import json
import shutil
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence

import pandas as pd


@dataclass
class IngestionConfig:
    """Configuration for the :class:`IngestionEngine`."""

    forecast_dir: Path
    detection_dir: Path
    forecast_glob: str = "*.csv"
    detection_glob: str = "*.csv"
    archive_dir: Optional[Path] = None
    state_path: Optional[Path] = None
    require_pairs: bool = True
    poll_interval_sec: float = 5.0

    def __post_init__(self) -> None:
        self.forecast_dir = Path(self.forecast_dir)
        self.detection_dir = Path(self.detection_dir)
        if self.archive_dir is not None:
            self.archive_dir = Path(self.archive_dir)
        if self.state_path is not None:
            self.state_path = Path(self.state_path)


@dataclass
class IngestionBatch:
    key: str
    forecast_path: Optional[Path]
    detection_path: Optional[Path]
    forecasts: pd.DataFrame
    detections: pd.DataFrame


@dataclass
class IngestionState:
    processed_keys: set[str] = field(default_factory=set)

    def to_dict(self) -> Dict[str, Sequence[str]]:
        return {"processed_keys": sorted(self.processed_keys)}

    @classmethod
    def from_path(cls, path: Optional[Path]) -> "IngestionState":
        if path is None or not path.exists():
            return cls()
        payload = json.loads(path.read_text(encoding="utf-8"))
        keys = set(payload.get("processed_keys", []))
        return cls(processed_keys=keys)

    def save(self, path: Optional[Path]) -> None:
        if path is None:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), indent=2), encoding="utf-8")


class IngestionEngine:
    """Polls configured directories for new forecast and detection files."""

    def __init__(self, config: IngestionConfig) -> None:
        self.config = config
        self.state = IngestionState.from_path(self.config.state_path)

        self.config.forecast_dir.mkdir(parents=True, exist_ok=True)
        self.config.detection_dir.mkdir(parents=True, exist_ok=True)
        if self.config.archive_dir is not None:
            (self.config.archive_dir / "forecasts").mkdir(parents=True, exist_ok=True)
            (self.config.archive_dir / "detections").mkdir(parents=True, exist_ok=True)

    def _glob_files(self, root: Path, pattern: str) -> List[Path]:
        return sorted(root.glob(pattern))

    @staticmethod
    def _extract_key(path: Path) -> str:
        return path.stem

    def discover_batches(self) -> List[IngestionBatch]:
        forecast_files = [p for p in self._glob_files(self.config.forecast_dir, self.config.forecast_glob) if p.exists()]
        detection_files = [p for p in self._glob_files(self.config.detection_dir, self.config.detection_glob) if p.exists()]

        detection_map: Dict[str, Path] = {self._extract_key(p): p for p in detection_files}
        batches: List[IngestionBatch] = []

        for forecast_path in forecast_files:
            key = self._extract_key(forecast_path)
            if key in self.state.processed_keys:
                continue

            detection_path = detection_map.get(key)
            if detection_path is None and self.config.require_pairs:
                continue

            forecasts = pd.read_csv(forecast_path)
            detections = pd.read_csv(detection_path) if detection_path is not None else pd.DataFrame()

            batches.append(
                IngestionBatch(
                    key=key,
                    forecast_path=forecast_path,
                    detection_path=detection_path,
                    forecasts=forecasts,
                    detections=detections,
                )
            )

        return batches

    def mark_processed(self, batch: IngestionBatch) -> None:
        self.state.processed_keys.add(batch.key)
        self.state.save(self.config.state_path)

        if self.config.archive_dir is not None and batch.forecast_path is not None:
            archive_forecast = self.config.archive_dir / "forecasts" / batch.forecast_path.name
            shutil.move(str(batch.forecast_path), archive_forecast)
        if self.config.archive_dir is not None and batch.detection_path is not None and batch.detection_path.exists():
            archive_detection = self.config.archive_dir / "detections" / batch.detection_path.name
            shutil.move(str(batch.detection_path), archive_detection)

    def poll(self, commit: bool = True) -> List[IngestionBatch]:
        batches = self.discover_batches()
        if commit:
            for batch in batches:
                self.mark_processed(batch)
        return batches

    def run_loop(self, callback, stop_after: Optional[int] = None) -> None:
        processed = 0
        while True:
            if stop_after is not None and processed >= stop_after:
                return
            batches = self.poll(commit=False)
            if batches:
                for batch in batches:
                    handled = callback(batch)
                    if handled:
                        self.mark_processed(batch)
                        processed += 1
                        if stop_after is not None and processed >= stop_after:
                            return
            else:
                time.sleep(self.config.poll_interval_sec)


__all__ = ["IngestionBatch", "IngestionConfig", "IngestionEngine"]