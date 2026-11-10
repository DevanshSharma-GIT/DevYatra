import pandas as pd
import pytest

from crowd_forecast.model_utils import compute_metrics, time_series_split


def test_time_series_split_shapes():
    df = pd.DataFrame({"value": range(100)})
    split = time_series_split(df, train_ratio=0.6, val_ratio=0.2)

    assert split.train.stop == 60
    assert split.val.stop == 80
    assert split.test.stop == 100


def test_time_series_split_input_validation():
    df = pd.DataFrame({"value": range(20)})
    with pytest.raises(ValueError):
        time_series_split(df, train_ratio=0.95, val_ratio=0.1)


def test_compute_metrics_basic():
    y_true = [10, 20, 30]
    y_pred = [12, 18, 33]

    metrics = compute_metrics(pd.Series(y_true).values, pd.Series(y_pred).values)
    assert set(metrics.keys()) == {"mae", "rmse", "mape"}
    assert metrics["mae"] > 0
