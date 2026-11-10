"""Tests for the high-level pipeline runner."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pandas.testing as pdt

from crowd_forecast.pipeline import PipelineConfig, PipelineRunner


def _forecasts_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "site": ["Ambaji", "Dwarka"],
            "ts": ["2024-01-01T00:00", "2024-01-01T00:00"],
            "forecast": [50000, 42000],
            "forecast_std": [4000, 3500],
        }
    )


def _detections_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "site": ["Ambaji", "Dwarka"],
            "ts": ["2024-01-01T00:00", "2024-01-01T00:00"],
            "detection_count": [54000, 43000],
            "detection_confidence": [0.9, 0.5],
        }
    )


def test_pipeline_runner_returns_outputs(tmp_path: Path) -> None:
    config = PipelineConfig()
    config.alert.default_capacity = 60000
    runner = PipelineRunner(config)
    outputs = runner.run(_forecasts_df(), _detections_df())

    fused = outputs["fused"]
    alerts = outputs["alerts"]

    assert "fused_estimate" in fused.columns
    assert len(alerts) == 2
    assert alerts["alert_level"].isin(["normal", "watch", "warning", "critical"]).all()

    forecasts_path = tmp_path / "forecasts.csv"
    detections_path = tmp_path / "detections.csv"
    fused_path = tmp_path / "fused.csv"
    alerts_path = tmp_path / "alerts.csv"

    _forecasts_df().to_csv(forecasts_path, index=False)
    _detections_df().to_csv(detections_path, index=False)

    outputs_from_files = runner.run_from_files(
        forecasts_path=forecasts_path,
        detections_path=detections_path,
        fused_output=fused_path,
        alert_output=alerts_path,
    )

    fused_saved = pd.read_csv(fused_path, parse_dates=["ts"])
    alerts_saved = pd.read_csv(alerts_path, parse_dates=["ts"])

    pdt.assert_frame_equal(outputs_from_files["fused"], fused_saved)
    pdt.assert_frame_equal(outputs_from_files["alerts"], alerts_saved)

    assert fused_path.exists()
    assert alerts_path.exists()