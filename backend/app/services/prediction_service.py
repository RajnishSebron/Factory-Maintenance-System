from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.events.broker import event_broker
from app.ml.features import build_feature_vector
from app.ml.inference import get_model_registry
from app.models.equipment import Equipment
from app.models.prediction import Prediction
from app.models.sensor_reading import SensorReading
from app.services.alert_service import create_alert_for_prediction


def risk_level(probability: float) -> str:
    if probability >= settings.critical_risk_failure_probability:
        return "critical"
    if probability >= settings.high_risk_failure_probability:
        return "high"
    if probability >= settings.alert_failure_probability:
        return "medium"
    return "low"


def run_prediction(db: Session, equipment_id: int, trigger_type: str = "scheduled") -> Prediction | None:
    equipment = db.get(Equipment, equipment_id)
    if not equipment or equipment.status != "active":
        return None
    readings = list(db.scalars(
        select(SensorReading)
        .where(SensorReading.equipment_id == equipment_id)
        .order_by(desc(SensorReading.recorded_at))
        .limit(10)
    ).all())
    if not readings:
        return None
    features = build_feature_vector(readings)
    result = get_model_registry().predict(features)
    probability = result["failure_probability"]
    prediction = Prediction(
        equipment_id=equipment.id,
        horizon_hours=settings.failure_horizon_hours,
        failure_probability=probability,
        failure_within_horizon=probability >= settings.alert_failure_probability,
        risk_level=risk_level(probability),
        rul_hours=result["rul_hours"],
        failure_model_version=result["failure_model_version"],
        rul_model_version=result["rul_model_version"],
        trigger_type=trigger_type,
        feature_snapshot=features,
    )
    db.add(prediction)
    db.flush()
    alert = create_alert_for_prediction(db, equipment, prediction)
    db.commit()
    db.refresh(prediction)
    event_broker.publish("prediction.created", {
        "id": prediction.id,
        "equipment_id": equipment.id,
        "equipment_name": equipment.name,
        "failure_probability": prediction.failure_probability,
        "risk_level": prediction.risk_level,
        "rul_hours": prediction.rul_hours,
        "horizon_hours": prediction.horizon_hours,
        "trigger_type": prediction.trigger_type,
        "created_at": prediction.created_at.isoformat() if prediction.created_at else None,
    })
    return prediction


def is_threshold_breach(equipment: Equipment, values: dict[str, float]) -> bool:
    thresholds = equipment.thresholds or {}
    return (
        values["temperature"] >= float(thresholds.get("temperature_max", 85.0))
        or values["vibration"] >= float(thresholds.get("vibration_max", 7.0))
        or values["pressure"] <= float(thresholds.get("pressure_min", 1.0))
        or values["pressure"] >= float(thresholds.get("pressure_max", 12.0))
        or values["current"] >= float(thresholds.get("current_max", 30.0))
    )
