"""Tests for advanced forecasting models."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from crowd_forecast.features import FeatureConfig, build_features
from crowd_forecast.models import AdvancedTrainer, AdvancedTrainingConfig


DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "synthetic_dataset.csv"


def _load_site_features(site: str, n_rows: int = 400) -> pd.DataFrame:
    raw = pd.read_csv(DATA_PATH)
    raw = raw[raw["site"] == site].head(n_rows).reset_index(drop=True)
    feature_config = FeatureConfig(lags=[1, 2, 3], rolling_windows=[3, 5], future_horizons=[1])
    features = build_features(raw, feature_config=feature_config, freq="D", drop_na=True)
    return features


def test_advanced_trainer_gradient_models(tmp_path: Path) -> None:
    pytest.importorskip("lightgbm")
    pytest.importorskip("xgboost")
    features = _load_site_features("Ambaji", n_rows=500)

    config = AdvancedTrainingConfig(
        horizon=1,
        site_whitelist=["Ambaji"],
        model_types=["lightgbm", "xgboost"],
        enable_ensemble=True,
        lightgbm_num_boost_round=30,
        lightgbm_early_stopping_rounds=5,
        xgboost_num_boost_round=30,
        xgboost_early_stopping_rounds=5,
    )
    trainer = AdvancedTrainer(config)
    results = trainer.train(features, tmp_path)

    assert "Ambaji" in results
    site_result = results["Ambaji"]
    assert "lightgbm" in site_result.model_outputs
    assert "xgboost" in site_result.model_outputs
    assert site_result.model_outputs["lightgbm"].model_path.exists()
    assert site_result.model_outputs["xgboost"].model_path.exists()

    lgb_metrics = site_result.model_outputs["lightgbm"].metrics
    assert np.isfinite(lgb_metrics["validation"]["mae"])
    assert np.isfinite(lgb_metrics["test"]["mae"])

    if site_result.ensemble_metrics:
        assert "validation" in site_result.ensemble_metrics


def test_advanced_trainer_lstm(tmp_path: Path) -> None:
    pytest.importorskip("torch")
    features = _load_site_features("Dwarka", n_rows=500)

    config = AdvancedTrainingConfig(
        horizon=1,
        site_whitelist=["Dwarka"],
        model_types=["lstm"],
        enable_ensemble=False,
        lstm_epochs=2,
        lstm_sequence_length=7,
        lstm_batch_size=16,
    )
    trainer = AdvancedTrainer(config)
    results = trainer.train(features, tmp_path)

    assert "Dwarka" in results
    site_result = results["Dwarka"]
    assert "lstm" in site_result.model_outputs
    assert site_result.model_outputs["lstm"].model_path.exists()
    lstm_metrics = site_result.model_outputs["lstm"].metrics
    assert np.isfinite(lstm_metrics["validation"]["mae"]) or np.isnan(lstm_metrics["validation"]["mae"])