"""Advanced forecasting models including gradient boosting and LSTM ensembles."""

from __future__ import annotations

import json
import logging
import pickle
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
try:  # Optional dependency: torch is required only for LSTM models
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset
except ImportError:  # pragma: no cover - exercised in environments without torch
    torch = None  # type: ignore
    nn = None  # type: ignore
    DataLoader = TensorDataset = None  # type: ignore

from crowd_forecast.model_utils import TimeSplit, compute_metrics, time_series_split


@dataclass
class AdvancedTrainingConfig:
    """Configuration for the advanced training pipeline."""

    horizon: int = 1
    target_template: str = "target_t+{horizon}"
    train_ratio: float = 0.7
    val_ratio: float = 0.15
    model_types: List[str] = field(default_factory=lambda: ["lightgbm", "xgboost", "lstm"])
    enable_ensemble: bool = True
    ensemble_name: str = "ensemble_mean"
    ensemble_weights: Optional[Dict[str, float]] = None
    lightgbm_params: Dict[str, float] = field(
        default_factory=lambda: {
            "objective": "regression",
            "metric": ["l1"],
            "learning_rate": 0.05,
            "num_leaves": 31,
            "feature_fraction": 0.8,
            "bagging_fraction": 0.8,
            "bagging_freq": 5,
        }
    )
    lightgbm_num_boost_round: int = 300
    lightgbm_early_stopping_rounds: int = 40
    xgboost_params: Dict[str, float] = field(
        default_factory=lambda: {
            "objective": "reg:squarederror",
            "learning_rate": 0.05,
            "max_depth": 6,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "reg_alpha": 0.1,
            "reg_lambda": 0.8,
            "eval_metric": "mae",
        }
    )
    xgboost_num_boost_round: int = 250
    xgboost_early_stopping_rounds: int = 40
    lstm_sequence_length: int = 24
    lstm_hidden_size: int = 64
    lstm_num_layers: int = 2
    lstm_dropout: float = 0.1
    lstm_epochs: int = 15
    lstm_learning_rate: float = 1e-3
    lstm_batch_size: int = 64
    lstm_feature_columns: Optional[List[str]] = None
    feature_blacklist: Optional[List[str]] = None
    feature_whitelist: Optional[List[str]] = None
    site_whitelist: Optional[List[str]] = None
    random_seed: int = 2024
    device: str = "cpu"

    def target_column(self) -> str:
        return self.target_template.format(horizon=self.horizon)


@dataclass
class ModelTrainingOutput:
    model_name: str
    model_path: Path
    metrics: Dict[str, Dict[str, float]]
    val_predictions: np.ndarray
    test_predictions: np.ndarray


@dataclass
class SiteTrainingResult:
    site: str
    split: TimeSplit
    model_outputs: Dict[str, ModelTrainingOutput]
    ensemble_metrics: Optional[Dict[str, Dict[str, float]]]


if torch is not None:

    class _LSTMRegressor(nn.Module):
        def __init__(self, input_size: int, hidden_size: int, num_layers: int, dropout: float):
            super().__init__()
            self.lstm = nn.LSTM(
                input_size=input_size,
                hidden_size=hidden_size,
                num_layers=num_layers,
                dropout=dropout if num_layers > 1 else 0.0,
                batch_first=True,
            )
            self.fc = nn.Linear(hidden_size, 1)

        def forward(self, x):
            output, _ = self.lstm(x)
            last = output[:, -1, :]
            return self.fc(last).squeeze(-1)

else:

    class _LSTMRegressor:  # pragma: no cover - exercised when torch is unavailable
        def __init__(self, *args, **kwargs):
            raise ImportError("PyTorch is required to instantiate _LSTMRegressor")


class AdvancedTrainer:
    """Train advanced models (LightGBM, XGBoost, LSTM) and optionally ensemble them."""

    def __init__(self, config: Optional[AdvancedTrainingConfig] = None):
        self.config = config or AdvancedTrainingConfig()
        self._logger = logging.getLogger(__name__)
        self._trained: Dict[str, SiteTrainingResult] = {}

    def train(self, features: pd.DataFrame, output_dir: Path) -> Dict[str, SiteTrainingResult]:
        output_dir.mkdir(parents=True, exist_ok=True)

        target_col = self.config.target_column()
        if target_col not in features.columns:
            raise ValueError(f"Target column '{target_col}' not found in features")

        np.random.seed(self.config.random_seed)
        if torch is not None:
            torch.manual_seed(self.config.random_seed)
            if torch.cuda.is_available():
                torch.cuda.manual_seed_all(self.config.random_seed)

        for site_name, site_df in features.groupby("site"):
            if self.config.site_whitelist and site_name not in self.config.site_whitelist:
                continue

            self._logger.info("Training advanced models for site %s", site_name)
            result = self._train_site(site_name, site_df.copy(), output_dir, target_col)
            if result:
                self._trained[site_name] = result

        self._write_model_card(output_dir)
        return self._trained

    def _train_site(
        self,
        site: str,
        site_df: pd.DataFrame,
        output_dir: Path,
        target_col: str,
    ) -> Optional[SiteTrainingResult]:
        dataset = site_df.sort_values("ts").copy()
        dataset = dataset.dropna(subset=[target_col])
        dataset = dataset.reset_index(drop=True)

        if len(dataset) < 40:
            self._logger.warning("Skipping site %s due to insufficient data (%d rows)", site, len(dataset))
            return None

        feature_cols = self._resolve_feature_columns(dataset, target_col)
        dataset[feature_cols] = dataset[feature_cols].ffill().bfill().fillna(0)

        split = time_series_split(dataset, self.config.train_ratio, self.config.val_ratio)

        model_outputs: Dict[str, ModelTrainingOutput] = {}

        X_train = dataset.iloc[split.train][feature_cols]
        y_train = dataset.iloc[split.train][target_col]
        X_val = dataset.iloc[split.val][feature_cols]
        y_val = dataset.iloc[split.val][target_col]
        X_test = dataset.iloc[split.test][feature_cols]
        y_test = dataset.iloc[split.test][target_col]

        if "lightgbm" in self.config.model_types:
            output = self._train_lightgbm(site, output_dir, feature_cols, X_train, y_train, X_val, y_val, X_test, y_test)
            if output:
                model_outputs["lightgbm"] = output

        if "xgboost" in self.config.model_types:
            output = self._train_xgboost(site, output_dir, feature_cols, X_train, y_train, X_val, y_val, X_test, y_test)
            if output:
                model_outputs["xgboost"] = output

        if "lstm" in self.config.model_types:
            output = self._train_lstm(site, output_dir, dataset, split, target_col)
            if output:
                model_outputs["lstm"] = output

        ensemble_metrics: Optional[Dict[str, Dict[str, float]]] = None
        if self.config.enable_ensemble and len(model_outputs) > 1:
            ensemble_metrics = self._build_ensemble_metrics(model_outputs, y_val, y_test)

        self._write_site_metrics(output_dir, site, model_outputs, ensemble_metrics)

        return SiteTrainingResult(site=site, split=split, model_outputs=model_outputs, ensemble_metrics=ensemble_metrics)

    def _resolve_feature_columns(self, df: pd.DataFrame, target_col: str) -> List[str]:
        if self.config.feature_whitelist:
            whitelist = [col for col in self.config.feature_whitelist if col in df.columns]
            if not whitelist:
                raise ValueError("feature_whitelist did not match any columns")
            return whitelist

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
        if self.config.feature_blacklist:
            excluded.update(self.config.feature_blacklist)

        feature_cols = [col for col in df.columns if col not in excluded and not col.startswith("target_")]
        if not feature_cols:
            raise ValueError("No usable feature columns identified for advanced models")
        return feature_cols

    def _train_lightgbm(
        self,
        site: str,
        output_dir: Path,
        feature_cols: List[str],
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: pd.DataFrame,
        y_val: pd.Series,
        X_test: pd.DataFrame,
        y_test: pd.Series,
    ) -> Optional[ModelTrainingOutput]:
        import lightgbm as lgb

        if X_train.empty:
            self._logger.warning("LightGBM skipped for site %s due to empty training data", site)
            return None

        params = dict(self.config.lightgbm_params)
        params.setdefault("seed", self.config.random_seed)
        train_dataset = lgb.Dataset(X_train.values, label=y_train.values)
        valid_sets = [train_dataset]
        valid_names = ["train"]

        callbacks = []
        if not X_val.empty:
            valid_sets.append(lgb.Dataset(X_val.values, label=y_val.values))
            valid_names.append("val")
            callbacks.append(lgb.early_stopping(self.config.lightgbm_early_stopping_rounds, verbose=False))

        # Silence training logs unless explicitly configured otherwise.
        callbacks.append(lgb.log_evaluation(period=0))

        model = lgb.train(
            params,
            train_dataset,
            num_boost_round=self.config.lightgbm_num_boost_round,
            valid_sets=valid_sets,
            valid_names=valid_names,
            callbacks=callbacks,
        )

        val_pred = model.predict(X_val.values) if not X_val.empty else np.array([])
        test_pred = model.predict(X_test.values) if not X_test.empty else np.array([])

        metrics = {
            "validation": compute_metrics(y_val.values, val_pred) if len(val_pred) else {"mae": float("nan"), "rmse": float("nan"), "mape": float("nan")},
            "test": compute_metrics(y_test.values, test_pred) if len(test_pred) else {"mae": float("nan"), "rmse": float("nan"), "mape": float("nan")},
        }

        metrics["train_size"] = {"count": float(len(X_train))}
        metrics["val_size"] = {"count": float(len(X_val))}
        metrics["test_size"] = {"count": float(len(X_test))}

        model_path = output_dir / f"{site}_lightgbm.pkl"
        with model_path.open("wb") as handle:
            pickle.dump({"model": model, "feature_cols": feature_cols}, handle)

        return ModelTrainingOutput(
            model_name="lightgbm",
            model_path=model_path,
            metrics=metrics,
            val_predictions=val_pred,
            test_predictions=test_pred,
        )

    def _train_xgboost(
        self,
        site: str,
        output_dir: Path,
        feature_cols: List[str],
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: pd.DataFrame,
        y_val: pd.Series,
        X_test: pd.DataFrame,
        y_test: pd.Series,
    ) -> Optional[ModelTrainingOutput]:
        import xgboost as xgb

        if X_train.empty:
            self._logger.warning("XGBoost skipped for site %s due to empty training data", site)
            return None

        params = dict(self.config.xgboost_params)
        params.setdefault("seed", self.config.random_seed)

        dtrain = xgb.DMatrix(X_train.values, label=y_train.values, feature_names=feature_cols)
        evals = [(dtrain, "train")]
        callbacks = []

        if not X_val.empty:
            dval = xgb.DMatrix(X_val.values, label=y_val.values, feature_names=feature_cols)
            evals.append((dval, "val"))
            callbacks.append(xgb.callback.EarlyStopping(self.config.xgboost_early_stopping_rounds, save_best=True))

        model = xgb.train(
            params,
            dtrain,
            num_boost_round=self.config.xgboost_num_boost_round,
            evals=evals,
            callbacks=callbacks,
            verbose_eval=False,
        )

        val_pred = model.predict(xgb.DMatrix(X_val.values, feature_names=feature_cols)) if not X_val.empty else np.array([])
        test_pred = model.predict(xgb.DMatrix(X_test.values, feature_names=feature_cols)) if not X_test.empty else np.array([])

        metrics = {
            "validation": compute_metrics(y_val.values, val_pred) if len(val_pred) else {"mae": float("nan"), "rmse": float("nan"), "mape": float("nan")},
            "test": compute_metrics(y_test.values, test_pred) if len(test_pred) else {"mae": float("nan"), "rmse": float("nan"), "mape": float("nan")},
        }
        metrics["train_size"] = {"count": float(len(X_train))}
        metrics["val_size"] = {"count": float(len(X_val))}
        metrics["test_size"] = {"count": float(len(X_test))}

        model_path = output_dir / f"{site}_xgboost.pkl"
        with model_path.open("wb") as handle:
            pickle.dump({"model": model, "feature_cols": feature_cols}, handle)

        return ModelTrainingOutput(
            model_name="xgboost",
            model_path=model_path,
            metrics=metrics,
            val_predictions=val_pred,
            test_predictions=test_pred,
        )

    def _train_lstm(
        self,
        site: str,
        output_dir: Path,
        dataset: pd.DataFrame,
        split: TimeSplit,
        target_col: str,
    ) -> Optional[ModelTrainingOutput]:
        if torch is None:
            raise ImportError("PyTorch is required to train the LSTM model. Please install torch.")

        feature_cols = self.config.lstm_feature_columns or [
            "visitor_count",
            "booked_slots",
            "weather_temp_c",
            "weather_precip_mm",
            "is_festival",
            "is_weekend",
        ]
        feature_cols = [col for col in feature_cols if col in dataset.columns]
        if not feature_cols:
            self._logger.warning("LSTM skipped for site %s due to missing feature columns", site)
            return None

        seq_len = max(2, self.config.lstm_sequence_length)

        train_df = dataset.iloc[split.train].copy()
        val_df = dataset.iloc[split.val].copy()
        test_df = dataset.iloc[split.test].copy()

        train_seq, train_target = self._build_sequences(train_df, feature_cols, target_col, seq_len)
        val_seq, val_target = self._build_sequences(val_df, feature_cols, target_col, seq_len)
        test_seq, test_target = self._build_sequences(test_df, feature_cols, target_col, seq_len)

        if len(train_seq) == 0:
            self._logger.warning("LSTM skipped for site %s due to insufficient sequence data", site)
            return None

        device = torch.device(self.config.device if torch.cuda.is_available() else "cpu")
        model = _LSTMRegressor(
            input_size=len(feature_cols),
            hidden_size=self.config.lstm_hidden_size,
            num_layers=self.config.lstm_num_layers,
            dropout=self.config.lstm_dropout,
        ).to(device)

        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(model.parameters(), lr=self.config.lstm_learning_rate)

        train_loader = DataLoader(
            TensorDataset(torch.from_numpy(train_seq), torch.from_numpy(train_target)),
            batch_size=self.config.lstm_batch_size,
            shuffle=True,
        )

        val_loader = None
        if len(val_seq) > 0:
            val_loader = DataLoader(
                TensorDataset(torch.from_numpy(val_seq), torch.from_numpy(val_target)),
                batch_size=self.config.lstm_batch_size,
                shuffle=False,
            )

        for epoch in range(self.config.lstm_epochs):
            model.train()
            epoch_loss = 0.0
            for batch_x, batch_y in train_loader:
                batch_x = batch_x.to(device)
                batch_y = batch_y.to(device)
                optimizer.zero_grad()
                preds = model(batch_x)
                loss = criterion(preds, batch_y)
                loss.backward()
                optimizer.step()
                epoch_loss += loss.item()

            if val_loader:
                model.eval()
                with torch.no_grad():
                    val_losses = []
                    for batch_x, batch_y in val_loader:
                        batch_x = batch_x.to(device)
                        batch_y = batch_y.to(device)
                        preds = model(batch_x)
                        val_losses.append(criterion(preds, batch_y).item())
                avg_val_loss = float(np.mean(val_losses)) if val_losses else float("nan")
                self._logger.debug("LSTM epoch %d val_loss=%.5f", epoch + 1, avg_val_loss)

        model.eval()
        with torch.no_grad():
            val_pred = model(torch.from_numpy(val_seq).to(device)).cpu().numpy() if len(val_seq) > 0 else np.array([])
            test_pred = model(torch.from_numpy(test_seq).to(device)).cpu().numpy() if len(test_seq) > 0 else np.array([])

        metrics = {
            "validation": compute_metrics(val_target, val_pred) if len(val_pred) else {"mae": float("nan"), "rmse": float("nan"), "mape": float("nan")},
            "test": compute_metrics(test_target, test_pred) if len(test_pred) else {"mae": float("nan"), "rmse": float("nan"), "mape": float("nan")},
        }
        metrics["train_size"] = {"count": float(len(train_seq))}
        metrics["val_size"] = {"count": float(len(val_seq))}
        metrics["test_size"] = {"count": float(len(test_seq))}

        model_path = output_dir / f"{site}_lstm.pt"
        torch.save(
            {
                "model_state": model.state_dict(),
                "input_size": len(feature_cols),
                "hidden_size": self.config.lstm_hidden_size,
                "num_layers": self.config.lstm_num_layers,
                "dropout": self.config.lstm_dropout,
                "sequence_length": seq_len,
                "feature_columns": feature_cols,
            },
            model_path,
        )

        return ModelTrainingOutput(
            model_name="lstm",
            model_path=model_path,
            metrics=metrics,
            val_predictions=val_pred,
            test_predictions=test_pred,
        )

    def _build_sequences(
        self,
        df: pd.DataFrame,
        feature_cols: List[str],
        target_col: str,
        seq_len: int,
    ) -> Tuple[np.ndarray, np.ndarray]:
        if len(df) <= seq_len:
            return np.empty((0, seq_len, len(feature_cols)), dtype=np.float32), np.empty((0,), dtype=np.float32)

        features = df[feature_cols].values.astype(np.float32)
        target = df[target_col].values.astype(np.float32)

        sequences = []
        targets = []
        for idx in range(seq_len, len(df)):
            sequences.append(features[idx - seq_len: idx])
            targets.append(target[idx])

        return np.stack(sequences), np.array(targets, dtype=np.float32)

    def _build_ensemble_metrics(
        self,
        model_outputs: Dict[str, ModelTrainingOutput],
        y_val: pd.Series,
        y_test: pd.Series,
    ) -> Dict[str, Dict[str, float]]:
        val_available = {name: output for name, output in model_outputs.items() if len(output.val_predictions)}
        if not val_available:
            return {}

        test_available = {name: output for name, output in model_outputs.items() if len(output.test_predictions)}

        base_weights = self.config.ensemble_weights or {name: 1.0 for name in val_available}

        def normalize(weights: Dict[str, float], available_keys: Dict[str, ModelTrainingOutput]) -> Dict[str, float]:
            filtered = {name: weights.get(name, 1.0) for name in available_keys}
            if not filtered:
                return {}
            total = sum(filtered.values())
            if total == 0:
                size = len(filtered)
                return {name: 1.0 / size for name in filtered}
            return {name: value / total for name, value in filtered.items()}

        val_weights = normalize(base_weights, val_available)
        if not val_weights:
            val_weights = {name: 1.0 / len(val_available) for name in val_available}

        test_weights = normalize(base_weights, test_available)

        def combine(predictions: Dict[str, np.ndarray], norm_weights: Dict[str, float]) -> np.ndarray:
            if not norm_weights:
                return np.array([])
            stacked = np.stack([predictions[name] * norm_weights[name] for name in norm_weights], axis=0)
            return np.sum(stacked, axis=0)

        val_preds = combine({name: output.val_predictions for name, output in val_available.items()}, val_weights)
        test_preds = combine({name: output.test_predictions for name, output in test_available.items()}, test_weights)

        ensemble_metrics = {
            "validation": compute_metrics(y_val.values[: len(val_preds)], val_preds) if len(val_preds) else {"mae": float("nan"), "rmse": float("nan"), "mape": float("nan")},
            "test": compute_metrics(y_test.values[: len(test_preds)], test_preds) if len(test_preds) else {"mae": float("nan"), "rmse": float("nan"), "mape": float("nan")},
        }
        ensemble_metrics["model_weights_validation"] = val_weights
        if test_weights:
            ensemble_metrics["model_weights_test"] = test_weights
        return ensemble_metrics

    def _write_site_metrics(
        self,
        output_dir: Path,
        site: str,
        model_outputs: Dict[str, ModelTrainingOutput],
        ensemble_metrics: Optional[Dict[str, Dict[str, float]]],
    ) -> None:
        metrics_payload = {
            "site": site,
            "models": {
                name: {
                    "model_path": str(output.model_path),
                    "metrics": output.metrics,
                }
                for name, output in model_outputs.items()
            },
        }

        if ensemble_metrics:
            metrics_payload["ensemble"] = {
                "name": self.config.ensemble_name,
                "metrics": ensemble_metrics,
            }

        site_metrics_path = output_dir / f"{site}_advanced_metrics.json"
        site_metrics_path.write_text(json.dumps(metrics_payload, indent=2), encoding="utf-8")

    def _write_model_card(self, output_dir: Path) -> None:
        if not self._trained:
            self._logger.warning("No advanced models were trained; skipping model card generation")
            return

        card = {
            "model_version": "advanced-ensemble-v1",
            "horizon": self.config.horizon,
            "models": [],
            "ensemble": self.config.enable_ensemble,
        }

        for site, result in self._trained.items():
            card["models"].append(
                {
                    "site": site,
                    "trained_models": {
                        name: {
                            "path": str(output.model_path),
                            "metrics": output.metrics,
                        }
                        for name, output in result.model_outputs.items()
                    },
                    "ensemble_metrics": result.ensemble_metrics,
                    "split": {
                        "train": [result.split.train.start, result.split.train.stop],
                        "val": [result.split.val.start, result.split.val.stop],
                        "test": [result.split.test.start, result.split.test.stop],
                    },
                }
            )

        model_card_path = output_dir / "advanced_model_card.json"
        model_card_path.write_text(json.dumps(card, indent=2), encoding="utf-8")


__all__ = ["AdvancedTrainer", "AdvancedTrainingConfig", "SiteTrainingResult", "ModelTrainingOutput"]