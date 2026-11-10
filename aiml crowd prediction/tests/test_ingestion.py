"""Tests for the ingestion module."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from crowd_forecast.ingestion import IngestionConfig, IngestionEngine


def _write_csv(path: Path, **columns) -> None:
    df = pd.DataFrame(columns)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)


def test_ingestion_detects_new_pairs_and_archives(tmp_path: Path) -> None:
    forecast_dir = tmp_path / "forecasts"
    detection_dir = tmp_path / "detections"
    archive_dir = tmp_path / "archive"
    state_path = tmp_path / "state.json"

    config = IngestionConfig(
        forecast_dir=forecast_dir,
        detection_dir=detection_dir,
        archive_dir=archive_dir,
        state_path=state_path,
    )
    engine = IngestionEngine(config)

    forecast_path = forecast_dir / "20240101.csv"
    detection_path = detection_dir / "20240101.csv"
    _write_csv(forecast_path, site=["Ambaji"], ts=["2024-01-01T00:00"], forecast=[50000])
    _write_csv(detection_path, site=["Ambaji"], ts=["2024-01-01T00:00"], detection_count=[52000])

    batches = engine.poll(commit=False)
    assert len(batches) == 1
    batch = batches[0]
    assert batch.key == "20240101"
    pd.testing.assert_frame_equal(batch.forecasts, pd.read_csv(forecast_path))
    pd.testing.assert_frame_equal(batch.detections, pd.read_csv(detection_path))

    engine.mark_processed(batch)

    assert archive_dir.joinpath("forecasts", "20240101.csv").exists()
    assert archive_dir.joinpath("detections", "20240101.csv").exists()
    assert json.loads(state_path.read_text(encoding="utf-8"))["processed_keys"] == ["20240101"]

    assert engine.poll() == []


def test_poll_commit_true_updates_state(tmp_path: Path) -> None:
    forecast_dir = tmp_path / "f"
    detection_dir = tmp_path / "d"
    state_path = tmp_path / "state.json"

    config = IngestionConfig(
        forecast_dir=forecast_dir,
        detection_dir=detection_dir,
        state_path=state_path,
    )
    engine = IngestionEngine(config)

    _write_csv(forecast_dir / "batch.csv", site=["Dwarka"], ts=["2024-01-02T00:00"], forecast=[43000])
    _write_csv(detection_dir / "batch.csv", site=["Dwarka"], ts=["2024-01-02T00:00"], detection_count=[41000])

    first_poll = engine.poll()
    assert len(first_poll) == 1
    assert engine.poll() == []

    processed_keys = json.loads(state_path.read_text(encoding="utf-8"))["processed_keys"]
    assert processed_keys == ["batch"]


def test_ingestion_allows_forecast_only_when_pairs_disabled(tmp_path: Path) -> None:
    forecast_dir = tmp_path / "forecast"
    detection_dir = tmp_path / "detect"

    config = IngestionConfig(
        forecast_dir=forecast_dir,
        detection_dir=detection_dir,
        require_pairs=False,
    )
    engine = IngestionEngine(config)

    _write_csv(forecast_dir / "solo.csv", site=["Somnath"], ts=["2024-01-03T00:00"], forecast=[39000])

    batches = engine.poll()
    assert len(batches) == 1
    assert batches[0].detections.empty