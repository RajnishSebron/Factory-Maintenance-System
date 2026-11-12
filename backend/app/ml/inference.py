from functools import lru_cache
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from app.core.config import settings
from app.ml.features import FEATURE_COLUMNS


class ModelRegistry:
    def __init__(self) -> None:
        self.artifact_dir = Path(settings.artifacts_dir)
        self.failure_path = self.artifact_dir / "failure_model.joblib"
        self.rul_path = self.artifact_dir / "rul_model.joblib"
        self._failure_model = None
        self._rul_model = None
        self._failure_version = "fallback"
        self._rul_version = "fallback"
        self.load()

    def load(self) -> None:
        self.artifact_dir.mkdir(parents=True, exist_ok=True)
        if self.failure_path.exists():
            bundle = joblib.load(self.failure_path)
            self._failure_model = bundle["model"]
            self._failure_version = bundle.get("version", "trained")
        if self.rul_path.exists():
            bundle = joblib.load(self.rul_path)
            self._rul_model = bundle["model"]
            self._rul_version = bundle.get("version", "trained")

    @staticmethod
    def _frame(features: dict[str, float]) -> pd.DataFrame:
        return pd.DataFrame([[features.get(name, 0.0) for name in FEATURE_COLUMNS]], columns=FEATURE_COLUMNS)

    def predict(self, features: dict[str, float]) -> dict:
        frame = self._frame(features)
        if self._failure_model is not None:
            probabilities = self._failure_model.predict_proba(frame)[0]
            failure_probability = float(probabilities[1])
        else:
            # Development fallback only; replace with a trained and validated model.
            temp_score = max(0.0, (features["temperature"] - 65.0) / 35.0)
            vibration_score = max(0.0, (features["vibration"] - 2.0) / 8.0)
            pressure_score = max(0.0, (2.0 - features["pressure"]) / 2.0)
            current_score = max(0.0, (features["current"] - 15.0) / 25.0)
            raw = 0.10 + 0.38 * temp_score + 0.38 * vibration_score + 0.18 * pressure_score + 0.12 * current_score
            failure_probability = float(np.clip(raw, 0.01, 0.99))

        if self._rul_model is not None:
            rul_hours = float(self._rul_model.predict(frame)[0])
        else:
            # Development fallback only; RUL needs domain-specific calibration.
            degradation = (
                max(0.0, features["temperature"] - 60.0) * 0.8
                + max(0.0, features["vibration"] - 1.0) * 5.0
                + max(0.0, 3.0 - features["pressure"]) * 4.0
            )
            rul_hours = max(1.0, 1000.0 - degradation - features["operating_hours"] * 0.01)

        return {
            "failure_probability": float(np.clip(failure_probability, 0.0, 1.0)),
            "rul_hours": max(0.0, rul_hours),
            "failure_model_version": self._failure_version,
            "rul_model_version": self._rul_version,
        }


@lru_cache(maxsize=1)
def get_model_registry() -> ModelRegistry:
    return ModelRegistry()
