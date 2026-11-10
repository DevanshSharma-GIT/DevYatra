import pandas as pd
import pytest

from crowd_forecast.features import FeatureConfig, build_features
from crowd_forecast.synthetic import SyntheticGenerationSettings, generate_synthetic_dataset


@pytest.fixture(scope="module")
def synthetic_daily_df():
    config_settings = SyntheticGenerationSettings(
        years=1,
        start_year=2022,
        include_hourly=False,
        enable_weather=False,
        enable_outliers=False,
    )
    df, _ = generate_synthetic_dataset(settings=config_settings, seed=101)
    return df


def test_feature_builder_produces_required_columns(synthetic_daily_df):
    features = build_features(synthetic_daily_df, FeatureConfig(lags=[1, 7], rolling_windows=[3, 7]))

    expected_cols = {
        "lag_1",
        "lag_7",
        "rolling_mean_3",
        "rolling_mean_7",
        "rolling_std_3",
        "rolling_std_7",
        "special_event_flag",
        "target_t+1",
    }

    assert expected_cols.issubset(features.columns), f"Missing columns: {expected_cols - set(features.columns)}"


def test_lag_values_align_with_source(synthetic_daily_df):
    features = build_features(synthetic_daily_df, FeatureConfig(lags=[1], rolling_windows=[3]))

    assert "site_Ambaji" in features.columns
    sample_site = features[features["site_Ambaji"] == 1].copy()
    sample_site.sort_values("ts", inplace=True)

    original = synthetic_daily_df[synthetic_daily_df["site"] == "Ambaji"].copy()
    original["ts"] = pd.to_datetime(original["date"])
    original = original.set_index("ts")

    expected = original["visitor_count"].shift(1)
    aligned_expected = expected.reindex(pd.to_datetime(sample_site["ts"]))
    lagged = sample_site["lag_1"].values
    assert aligned_expected.notna().all()
    assert (aligned_expected.values == lagged).all()


def test_future_targets_present(synthetic_daily_df):
    cfg = FeatureConfig(lags=[1], rolling_windows=[3], future_horizons=[1, 24])
    features = build_features(synthetic_daily_df, cfg)
    assert "target_t+24" in features.columns


def test_missing_columns_raise_error():
    df = pd.DataFrame({"site": ["A"], "date": ["2024-01-01"]})
    with pytest.raises(ValueError):
        build_features(df)
