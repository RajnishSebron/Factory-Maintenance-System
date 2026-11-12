from sqlalchemy import desc, func, select
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.alert import Alert
from app.models.equipment import Equipment
from app.models.prediction import Prediction
from app.models.sensor_reading import SensorReading
from app.models.user import User

router = APIRouter()


@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    equipment_count = db.scalar(select(func.count(Equipment.id))) or 0
    active_equipment = db.scalar(select(func.count(Equipment.id)).where(Equipment.status == "active")) or 0
    unacknowledged_alerts = db.scalar(select(func.count(Alert.id)).where(Alert.is_acknowledged.is_(False))) or 0
    critical_alerts = db.scalar(select(func.count(Alert.id)).where(Alert.is_acknowledged.is_(False), Alert.severity == "critical")) or 0
    latest_predictions = list(db.scalars(select(Prediction).order_by(desc(Prediction.created_at)).limit(8)).all())
    latest_reading_count = db.scalar(select(func.count(SensorReading.id))) or 0
    return {
        "equipment_count": equipment_count,
        "active_equipment": active_equipment,
        "unacknowledged_alerts": unacknowledged_alerts,
        "critical_alerts": critical_alerts,
        "total_sensor_readings": latest_reading_count,
        "latest_predictions": [
            {"id": p.id, "equipment_id": p.equipment_id, "failure_probability": p.failure_probability,
             "risk_level": p.risk_level, "rul_hours": p.rul_hours, "created_at": p.created_at.isoformat(),
             "horizon_hours": p.horizon_hours, "trigger_type": p.trigger_type}
            for p in latest_predictions
        ],
    }
