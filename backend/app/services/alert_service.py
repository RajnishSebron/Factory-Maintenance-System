from sqlalchemy.orm import Session
from app.core.config import settings
from app.events.broker import event_broker
from app.models.alert import Alert
from app.models.equipment import Equipment
from app.models.prediction import Prediction


def severity_for_probability(probability: float) -> str:
    if probability >= settings.critical_risk_failure_probability:
        return "critical"
    if probability >= settings.high_risk_failure_probability:
        return "high"
    if probability >= settings.alert_failure_probability:
        return "medium"
    return "low"


def create_alert_for_prediction(db: Session, equipment: Equipment, prediction: Prediction) -> Alert | None:
    if prediction.failure_probability < settings.alert_failure_probability:
        return None
    severity = severity_for_probability(prediction.failure_probability)
    alert = Alert(
        equipment_id=equipment.id,
        prediction_id=prediction.id,
        alert_type="failure_risk",
        severity=severity,
        title=f"{severity.title()} failure risk: {equipment.name}",
        message=(
            f"Estimated failure probability within {prediction.horizon_hours} hours is "
            f"{prediction.failure_probability:.1%}. Estimated remaining useful life: "
            f"{prediction.rul_hours:.1f} operating hours. Inspect the equipment and plan maintenance."
        ),
    )
    db.add(alert)
    db.flush()
    event_broker.publish("alert.created", {
        "id": alert.id, "equipment_id": equipment.id, "equipment_name": equipment.name,
        "severity": alert.severity, "title": alert.title, "message": alert.message,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
    })
    return alert
