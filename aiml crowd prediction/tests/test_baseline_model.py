from pathlib import Path

import json
import pandas as pd

from crowd_forecast import (
    BaselineTrainer,
    BaselineTrainingConfig,
    FeatureConfig,
    SyntheticGenerationSettings,
    build_features,
    generate_synthetic_dataset,
)


def _prepare_features() -> pd.DataFrame:
    settings = SyntheticGenerationSettings(
        years=2,
        start_year=2021,
        include_hourly=False,
        enable_weather=False,
        enable_outliers=False,
    )
    df, _ = generate_synthetic_dataset(settings=settings, seed=2025)
    features = build_features(
        df,
        FeatureConfig(lags=[1, 7], rolling_windows=[3, 7], future_horizons=[1]),
        drop_na=True,
    )
    return features


def test_baseline_trainer_outputs_artifacts(tmp_path):
    features = _prepare_features()
    config = BaselineTrainingConfig(site_whitelist=["Ambaji"], horizon=1, maxiter=20)
    trainer = BaselineTrainer(config)

    results = trainer.train(features, tmp_path)

    assert "Ambaji" in results
    model_path = tmp_path / "Ambaji_sarimax.pkl"
    assert model_path.exists()

    card_path = tmp_path / "model_card.json"
    assert card_path.exists()

    metrics = results["Ambaji"].metrics
    for partition in ("validation", "test"):
        assert partition in metrics
        for metric_name in ("mae", "rmse", "mape"):
            assert metric_name in metrics[partition]

    mean_target = (
        features[features["site"] == "Ambaji"]["target_t+1"].dropna().mean()
    )
    assert metrics["test"]["mae"] <= 1.8 * mean_target


def test_model_card_contains_site(tmp_path):
    features = _prepare_features()
    config = BaselineTrainingConfig(site_whitelist=["Dwarka"], horizon=1, maxiter=15)
    trainer = BaselineTrainer(config)

    trainer.train(features, tmp_path)
    card_path = tmp_path / "model_card.json"
    payload = json.loads(card_path.read_text(encoding="utf-8"))

    assert "sites" in payload
    assert any(site_info["site"] == "Dwarka" for site_info in payload["sites"])
