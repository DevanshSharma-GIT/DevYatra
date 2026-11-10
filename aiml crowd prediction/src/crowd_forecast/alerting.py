"""Alerting logic for fused crowd estimates."""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Iterable, List, Optional

import pandas as pd


class AlertLevel(str, Enum):
    NORMAL = "normal"
    WATCH = "watch"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class Alert:
    site: str
    timestamp: dt.datetime
    level: AlertLevel
    message: str
    metrics: Dict[str, float] = field(default_factory=dict)


@dataclass
class AlertConfig:
    default_capacity: Optional[float] = None
    site_capacity: Dict[str, float] = field(default_factory=dict)
    warning_ratio: float = 0.7
    critical_ratio: float = 0.9
    sustained_window: int = 3
    detection_spike_ratio: float = 0.25

    def resolve_capacity(self, site: str) -> float:
        capacity = self.site_capacity.get(site, self.default_capacity)
        if capacity is None or capacity <= 0:
            raise ValueError(f"Capacity for site '{site}' is not configured or invalid")
        return capacity


class AlertEngine:
    REQUIRED_COLUMNS = {"site", "ts", "fused_estimate"}

    def __init__(self, config: Optional[AlertConfig] = None) -> None:
        self.config = config or AlertConfig()

    def generate_alerts(self, fused_df: pd.DataFrame) -> pd.DataFrame:
        missing = self.REQUIRED_COLUMNS.difference(fused_df.columns)
        if missing:
            raise ValueError(f"Missing required columns for alerting: {sorted(missing)}")

        df = fused_df.copy()
        df["ts"] = pd.to_datetime(df["ts"])

        df["capacity"] = df["site"].map(self.config.site_capacity)
        if self.config.default_capacity is not None:
            df["capacity"] = df["capacity"].fillna(self.config.default_capacity)

        if (df["capacity"].isna() | (df["capacity"] <= 0)).any():
            missing_sites = df.loc[df["capacity"].isna() | (df["capacity"] <= 0), "site"].unique()
            raise ValueError(f"Capacities missing or invalid for sites: {missing_sites.tolist()}")

        df["occupancy_ratio"] = df["fused_estimate"] / df["capacity"]
        df.sort_values(["site", "ts"], inplace=True)
        df["occupancy_ratio_smoothed"] = df.groupby("site")["occupancy_ratio"].transform(
            lambda s: s.rolling(self.config.sustained_window, min_periods=1).mean()
        )

        detection_ratio = None
        if "detection_count" in df.columns:
            detection_ratio = df["detection_count"] / df["capacity"]
        forecast_ratio = None
        if "forecast" in df.columns:
            forecast_ratio = df["forecast"] / df["capacity"]

        levels: List[AlertLevel] = []
        messages: List[str] = []

        for idx, row in df.iterrows():
            ratio = row["occupancy_ratio"]
            smoothed = row["occupancy_ratio_smoothed"]

            level = AlertLevel.NORMAL
            reasons = []

            if smoothed >= self.config.critical_ratio or ratio >= self.config.critical_ratio:
                level = AlertLevel.CRITICAL
                reasons.append(f"occupancy {ratio:.2f} exceeds critical threshold {self.config.critical_ratio:.2f}")
            elif smoothed >= self.config.warning_ratio or ratio >= self.config.warning_ratio:
                level = AlertLevel.WARNING
                reasons.append(f"occupancy {ratio:.2f} exceeds warning threshold {self.config.warning_ratio:.2f}")
            elif detection_ratio is not None and detection_ratio.loc[idx] >= self.config.warning_ratio * (1 + self.config.detection_spike_ratio):
                level = AlertLevel.WATCH
                reasons.append(
                    f"detection spike {detection_ratio.loc[idx]:.2f} above {(self.config.warning_ratio * (1 + self.config.detection_spike_ratio)):.2f}"
                )

            if not reasons:
                reasons.append("occupancy within normal range")

            if forecast_ratio is not None:
                delta = ratio - forecast_ratio.loc[idx]
                reasons.append(f"variance vs forecast {delta:+.2f}")

            levels.append(level)
            messages.append("; ".join(reasons))

        df["alert_level"] = levels
        df["alert_message"] = messages

        return df

    def to_alerts(self, alert_df: pd.DataFrame) -> List[Alert]:
        alerts: List[Alert] = []
        for _, row in alert_df.iterrows():
            alerts.append(
                Alert(
                    site=row["site"],
                    timestamp=row["ts"],
                    level=AlertLevel(row["alert_level"]),
                    message=row["alert_message"],
                    metrics={
                        "fused_estimate": float(row["fused_estimate"]),
                        "capacity": float(row["capacity"]),
                        "occupancy_ratio": float(row["occupancy_ratio"]),
                        "occupancy_ratio_smoothed": float(row["occupancy_ratio_smoothed"]),
                    },
                )
            )
        return alerts


__all__ = ["Alert", "AlertConfig", "AlertEngine", "AlertLevel"]