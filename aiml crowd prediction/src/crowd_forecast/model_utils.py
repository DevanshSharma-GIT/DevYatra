"""Utilities for model training workflows."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple

import numpy as np
import pandas as pd


@dataclass
class TimeSplit:
    train: slice
    val: slice
    test: slice


def time_series_split(
    df: pd.DataFrame,
    train_ratio: float = 0.7,
    val_ratio: float = 0.15,
) -> TimeSplit:
    if not 0 < train_ratio < 1:
        raise ValueError("train_ratio must be between 0 and 1")
    if not 0 <= val_ratio < 1:
        raise ValueError("val_ratio must be between 0 and 1")
    if train_ratio + val_ratio >= 1:
        raise ValueError("train_ratio + val_ratio must be < 1")

    n = len(df)
    if n < 10:
        raise ValueError("Dataset too small for splitting")

    train_end = int(n * train_ratio)
    val_end = train_end + int(n * val_ratio)

    return TimeSplit(
        train=slice(0, train_end),
        val=slice(train_end, val_end),
        test=slice(val_end, n),
    )


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    if len(y_true) == 0:
        raise ValueError("y_true cannot be empty")

    mae = float(np.mean(np.abs(y_true - y_pred)))
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    denom = np.clip(np.abs(y_true), a_min=1e-6, a_max=None)
    mape = float(np.mean(np.abs((y_true - y_pred) / denom)) * 100)

    return {"mae": mae, "rmse": rmse, "mape": mape}
