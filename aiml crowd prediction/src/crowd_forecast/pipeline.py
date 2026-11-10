"""End-to-end pipeline orchestration for fusion and alerting."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Optional

import pandas as pd

from .alerting import AlertConfig, AlertEngine
from .fusion import FusionConfig, FusionEngine, merge_forecast_detection


@dataclass
class PipelineConfig:
    fusion: FusionConfig = field(default_factory=FusionConfig)
    alert: AlertConfig = field(default_factory=AlertConfig)
    save_intermediate: bool = False


class PipelineRunner:
    """Coordinates fusion and alerting steps for crowd intelligence."""

    def __init__(self, config: Optional[PipelineConfig] = None) -> None:
        self.config = config or PipelineConfig()
        self._fusion_engine = FusionEngine(self.config.fusion)
        self._alert_engine = AlertEngine(self.config.alert)

    def run(
        self,
        forecasts: pd.DataFrame,
        detections: pd.DataFrame,
    ) -> Dict[str, pd.DataFrame]:
        merged = merge_forecast_detection(forecasts, detections)
        fused = self._fusion_engine.fuse(merged)
        alerts = self._alert_engine.generate_alerts(fused)
        return {"fused": fused, "alerts": alerts}

    def run_from_files(
        self,
        forecasts_path: Path,
        detections_path: Path,
        fused_output: Optional[Path] = None,
        alert_output: Optional[Path] = None,
    ) -> Dict[str, pd.DataFrame]:
        forecasts = pd.read_csv(forecasts_path)
        detections = pd.read_csv(detections_path)
        outputs = self.run(forecasts, detections)

        if fused_output:
            outputs["fused"].to_csv(fused_output, index=False)
        if alert_output:
            outputs["alerts"].to_csv(alert_output, index=False)

        return outputs


__all__ = ["PipelineConfig", "PipelineRunner"]