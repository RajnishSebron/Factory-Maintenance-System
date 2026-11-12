from statistics import pstdev
from typing import Iterable
from app.models.sensor_reading import SensorReading

FEATURE_COLUMNS = [
    "temperature", "vibration", "pressure", "rpm", "current", "operating_hours",
    "temperature_mean_10", "vibration_mean_10", "vibration_std_10",
    "pressure_mean_10", "current_mean_10", "rpm_mean_10",
]


def build_feature_vector(readings: Iterable[SensorReading]) -> dict[str, float]:
    rows = list(readings)
    if not rows:
        raise ValueError("At least one sensor reading is required")
    latest = rows[0]
    recent = rows[:10]
    def mean(field: str) -> float:
        values = [float(getattr(row, field)) for row in recent]
        return sum(values) / len(values)
    vibration_values = [float(row.vibration) for row in recent]
    return {
        "temperature": float(latest.temperature),
        "vibration": float(latest.vibration),
        "pressure": float(latest.pressure),
        "rpm": float(latest.rpm),
        "current": float(latest.current),
        "operating_hours": float(latest.operating_hours),
        "temperature_mean_10": mean("temperature"),
        "vibration_mean_10": mean("vibration"),
        "vibration_std_10": pstdev(vibration_values) if len(vibration_values) > 1 else 0.0,
        "pressure_mean_10": mean("pressure"),
        "current_mean_10": mean("current"),
        "rpm_mean_10": mean("rpm"),
    }
