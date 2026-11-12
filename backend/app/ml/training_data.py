from pathlib import Path
import numpy as np
import pandas as pd
from app.ml.features import FEATURE_COLUMNS


def generate_training_dataset(output_path: str | Path, rows: int = 12000, random_state: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(random_state)
    operating_hours = rng.uniform(50, 25000, rows)
    temperature = rng.normal(68, 12, rows).clip(35, 125)
    vibration = rng.gamma(2.0, 1.1, rows).clip(0.05, 15)
    pressure = rng.normal(5.5, 1.5, rows).clip(0.2, 12)
    rpm = rng.normal(1600, 180, rows).clip(500, 3000)
    current = rng.normal(13, 4, rows).clip(1, 45)
    # Synthetic feature aggregates. A real operating pipeline should compute these from time windows.
    temperature_mean_10 = (temperature + rng.normal(0, 3, rows)).clip(20, 150)
    vibration_mean_10 = (vibration + rng.normal(0, 0.35, rows)).clip(0, 20)
    vibration_std_10 = rng.uniform(0.01, 1.8, rows)
    pressure_mean_10 = (pressure + rng.normal(0, 0.25, rows)).clip(0, 15)
    current_mean_10 = (current + rng.normal(0, 1.0, rows)).clip(0, 50)
    rpm_mean_10 = (rpm + rng.normal(0, 30, rows)).clip(0, 3500)

    degradation = (
        np.maximum(temperature - 75, 0) / 18
        + np.maximum(vibration - 3.0, 0) / 3.5
        + np.maximum(2.5 - pressure, 0) / 2.0
        + np.maximum(current - 20, 0) / 18
        + operating_hours / 60000
    )
    logits = -3.0 + 1.2 * degradation + rng.normal(0, 0.65, rows)
    probability = 1 / (1 + np.exp(-logits))
    failure_label = (rng.random(rows) < probability).astype(int)
    rul_hours = np.maximum(5, 3500 - degradation * 650 - operating_hours * 0.045 + rng.normal(0, 180, rows))

    data = pd.DataFrame({
        "temperature": temperature, "vibration": vibration, "pressure": pressure,
        "rpm": rpm, "current": current, "operating_hours": operating_hours,
        "temperature_mean_10": temperature_mean_10,
        "vibration_mean_10": vibration_mean_10,
        "vibration_std_10": vibration_std_10,
        "pressure_mean_10": pressure_mean_10,
        "current_mean_10": current_mean_10,
        "rpm_mean_10": rpm_mean_10,
        "failure_within_24h": failure_label,
        "rul_hours": rul_hours,
    })
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    data.to_csv(output_path, index=False)
    return data
