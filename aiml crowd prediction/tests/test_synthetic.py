import pandas as pd

from crowd_forecast import AppConfig
from crowd_forecast.synthetic import SyntheticGenerationSettings, generate_synthetic_dataset


def _build_test_config() -> AppConfig:
    config = AppConfig.default()
    config.noise.outlier_probability = 0.0
    config.noise.distribution = "poisson"
    return config


def test_synthetic_totals_within_tolerance():
    config = _build_test_config()
    settings = SyntheticGenerationSettings(
        years=1,
        start_year=2023,
        include_hourly=False,
        global_tolerance=0.1,
        enable_weather=False,
        enable_outliers=False,
    )

    df, _ = generate_synthetic_dataset(config=config, settings=settings, seed=2024)

    totals = df.groupby("site")["visitor_count"].sum()
    for site, total in totals.items():
        anchor = config.anchor.sites[site].anchors.annual_visitors
        deviation = abs(total - anchor) / anchor
        assert deviation <= 0.1 + 1e-6


def test_festival_days_show_uplift():
    config = _build_test_config()
    settings = SyntheticGenerationSettings(
        years=1,
        start_year=2023,
        include_hourly=False,
        enable_weather=False,
        enable_outliers=False,
    )

    df, _ = generate_synthetic_dataset(config=config, settings=settings, seed=4321)

    assert (df["is_festival"] == 1).any(), "Expected at least one festival day"

    fest_means = (
        df[df["is_festival"] == 1].groupby("site")["visitor_count"].mean()
    )
    normal_means = (
        df[df["is_festival"] == 0].groupby("site")["visitor_count"].mean()
    )

    common_sites = set(fest_means.index) & set(normal_means.index)
    for site in common_sites:
        assert fest_means[site] > normal_means[site] * 1.05


def test_reproducibility_with_seed():
    config = _build_test_config()
    settings = SyntheticGenerationSettings(
        years=1,
        start_year=2023,
        enable_weather=False,
        enable_outliers=False,
    )

    df1, _ = generate_synthetic_dataset(config=config, settings=settings, seed=999)
    df2, _ = generate_synthetic_dataset(config=config, settings=settings, seed=999)

    sort_cols = ["site", "date", "time_slot"]
    df1_sorted = df1.sort_values(sort_cols).reset_index(drop=True).sort_index(axis=1)
    df2_sorted = df2.sort_values(sort_cols).reset_index(drop=True).sort_index(axis=1)
    pd.testing.assert_frame_equal(df1_sorted, df2_sorted)
