"""Baseline SARIMAX training pipeline."""

from __future__ import annotations

import json
import logging
import pickle
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX, SARIMAXResults

from crowd_forecast.model_utils import TimeSplit, compute_metrics, time_series_split


@dataclass
class BaselineTrainingConfig:
    horizon: int = 1
    target_template: str = "target_t+{horizon}"
    train_ratio: float = 0.7
    val_ratio: float = 0.15
    order: tuple = (1, 1, 1)
    seasonal_order: tuple = (1, 0, 1, 7)
    enforce_stationarity: bool = True
    enforce_invertibility: bool = True
    maxiter: int = 50
    convergence_tol: float = 1e-3
    save_threshold: Optional[float] = None  # minimum improvement to save model
    model_version: str = "baseline-sarimax-v1"
    metrics_ci: float = 0.9
    random_seed: int = 2024
    exog_columns: Optional[List[str]] = None
    site_whitelist: Optional[List[str]] = None

    def target_column(self) -> str:
        return self.target_template.format(horizon=self.horizon)


@dataclass
class TrainedModelInfo:
    site: str
    model_path: Path
    metrics: Dict[str, Dict[str, float]]
    config: BaselineTrainingConfig
    split: TimeSplit


class BaselineTrainer:
    def __init__(self, config: Optional[BaselineTrainingConfig] = None):
        self.config = config or BaselineTrainingConfig()
        self._trained: Dict[str, TrainedModelInfo] = {}
        self._logger = logging.getLogger(__name__)

    def train(self, features: pd.DataFrame, output_dir: Path) -> Dict[str, TrainedModelInfo]:
        output_dir.mkdir(parents=True, exist_ok=True)

        target_col = self.config.target_column()
        if target_col not in features.columns:
            raise ValueError(f"Target column '{target_col}' not found in features")

        for site_name, site_df in features.groupby("site"):
            if self.config.site_whitelist and site_name not in self.config.site_whitelist:
                continue

            self._logger.info("Training baseline model for site %s", site_name)
            trained_info = self._train_site(site_name, site_df, output_dir, target_col)
            if trained_info:
                self._trained[site_name] = trained_info

        self._write_model_card(output_dir)
        return self._trained

    def _train_site(
        self,
        site: str,
        site_df: pd.DataFrame,
        output_dir: Path,
        target_col: str,
    ) -> Optional[TrainedModelInfo]:
        dataset = site_df.sort_values("ts").copy()
        dataset = dataset.dropna(subset=[target_col])
        dataset = dataset.reset_index(drop=True)

        if len(dataset) < 30:
            self._logger.warning("Skipping site %s due to insufficient data (%d rows)", site, len(dataset))
            return None

        split = time_series_split(dataset, self.config.train_ratio, self.config.val_ratio)

        train_df = dataset.iloc[split.train]
        val_df = dataset.iloc[split.val]
        test_df = dataset.iloc[split.test]

        exog_cols = self._resolve_exog_columns(dataset, target_col)

        dataset = self._clean_exog(dataset, exog_cols)
        train_df = dataset.iloc[split.train]
        val_df = dataset.iloc[split.val]
        test_df = dataset.iloc[split.test]

        model = self._fit_model(train_df[target_col], train_df[exog_cols])

        metrics = self._forecast_and_score(
            model,
            val_df[target_col],
            test_df[target_col],
            val_df[exog_cols],
            test_df[exog_cols],
            len(train_df),
            len(val_df),
            len(test_df),
        )

        model_path = output_dir / f"{site}_sarimax.pkl"
        with model_path.open("wb") as handle:
            pickle.dump(model, handle)
        return TrainedModelInfo(
            site=site,
            model_path=model_path,
            metrics=metrics,
            config=self.config,
            split=split,
        )

    def _resolve_exog_columns(self, df: pd.DataFrame, target_col: str) -> List[str]:
        if self.config.exog_columns:
            return self.config.exog_columns

        excluded = {
            target_col,
            "ts",
            "timestamp",
            "site",
            "source",
            "seed",
            "date",
            "time_slot",
            "festival_name",
        }
        exog_cols = [col for col in df.columns if col not in excluded and not col.startswith("target_")]
        if not exog_cols:
            raise ValueError("No exogenous columns available for SARIMAX training")
        return exog_cols

    def _clean_exog(self, df: pd.DataFrame, exog_cols: List[str]) -> pd.DataFrame:
        cleaned = df.copy()
        exog = cleaned[exog_cols].copy()
        exog = exog.ffill().bfill().fillna(0)
        cleaned[exog_cols] = exog
        bool_cols = cleaned[exog_cols].select_dtypes(include="bool").columns
        if len(bool_cols) > 0:
            cleaned[bool_cols] = cleaned[bool_cols].astype(int)
        return cleaned

    def _fit_model(self, y: pd.Series, exog: pd.DataFrame) -> SARIMAXResults:
        model = SARIMAX(
            endog=y,
            exog=exog,
            order=self.config.order,
            seasonal_order=self.config.seasonal_order,
            enforce_stationarity=self.config.enforce_stationarity,
            enforce_invertibility=self.config.enforce_invertibility,
        )
        results = model.fit(maxiter=self.config.maxiter, disp=False, method="powell", tol=self.config.convergence_tol)
        return results

    def _forecast_and_score(
        self,
        model: SARIMAXResults,
        y_val: pd.Series,
        y_test: pd.Series,
        exog_val: pd.DataFrame,
        exog_test: pd.DataFrame,
        train_size: int,
        val_size: int,
        test_size: int,
    ) -> Dict[str, Dict[str, float]]:
        metrics: Dict[str, Dict[str, float]] = {}

        future_steps = val_size + test_size
        if future_steps > 0:
            exog_future = pd.concat([exog_val, exog_test], ignore_index=True)
            forecast = model.get_forecast(steps=future_steps, exog=exog_future if not exog_future.empty else None)
            predicted = forecast.predicted_mean
        else:
            predicted = pd.Series(dtype=float)

        if val_size > 0 and future_steps > 0:
            val_pred = predicted.iloc[:val_size]
            metrics["validation"] = compute_metrics(y_val.values, val_pred.values)
        else:
            metrics["validation"] = {"mae": float("nan"), "rmse": float("nan"), "mape": float("nan")}

        if test_size > 0 and future_steps > 0:
            test_pred = predicted.iloc[val_size:val_size + test_size]
            metrics["test"] = compute_metrics(y_test.values, test_pred.values)
        else:
            metrics["test"] = {"mae": float("nan"), "rmse": float("nan"), "mape": float("nan")}

        metrics["train_size"] = {"count": float(train_size)}
        metrics["val_size"] = {"count": float(val_size)}
        metrics["test_size"] = {"count": float(test_size)}

        return metrics

    def _write_model_card(self, output_dir: Path) -> None:
        if not self._trained:
            self._logger.warning("No models were trained; skipping model card generation")
            return

        card = {
            "model_version": self.config.model_version,
            "baseline_type": "SARIMAX",
            "horizon": self.config.horizon,
            "order": self.config.order,
            "seasonal_order": self.config.seasonal_order,
            "sites": [],
        }

        for site, info in self._trained.items():
            card["sites"].append(
                {
                    "site": site,
                    "model_path": str(info.model_path),
                    "metrics": info.metrics,
                    "split": {
                        "train": [info.split.train.start, info.split.train.stop],
                        "val": [info.split.val.start, info.split.val.stop],
                        "test": [info.split.test.start, info.split.test.stop],
                    },
                }
            )

        model_card_path = output_dir / "model_card.json"
        model_card_path.write_text(json.dumps(card, indent=2), encoding="utf-8")


__all__ = ["BaselineTrainer", "BaselineTrainingConfig"]
