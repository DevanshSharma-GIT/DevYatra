"""Tests for alerting engine."""

from __future__ import annotations

import datetime as dt

import pandas as pd

from crowd_forecast.alerting import AlertConfig, AlertEngine, AlertLevel


def _sample_fused() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "site": ["Ambaji", "Ambaji", "Ambaji", "Dwarka"],
            "ts": pd.to_datetime(
                [
                    "2024-01-01 00:00",
                    "2024-01-01 00:05",
                    "2024-01-01 00:10",
                    "2024-01-01 00:00",
                ]
            ),
            "fused_estimate": [58000, 64000, 76000, 30000],
            "detection_count": [59000, 65000, 77000, 28000],
            "forecast": [55000, 56000, 57000, 32000],
        }
    )


def test_alert_engine_assigns_levels():
    config = AlertConfig(default_capacity=80000, warning_ratio=0.75, critical_ratio=0.9)
    engine = AlertEngine(config)
    alerts = engine.generate_alerts(_sample_fused())

    assert list(alerts["alert_level"])[:3] == [AlertLevel.NORMAL, AlertLevel.WARNING, AlertLevel.CRITICAL]
    last_message = alerts.iloc[-1]["alert_message"]
    assert "variance" in last_message


def test_alert_engine_requires_capacity():
    engine = AlertEngine(AlertConfig(default_capacity=None))
    try:
        engine.generate_alerts(_sample_fused())
    except ValueError as exc:
        assert "Capacities" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("Expected ValueError for missing capacity")