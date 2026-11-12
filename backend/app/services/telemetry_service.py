from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.config import settings
from app.events.broker import event_broker
from app.models.equipment import Equipment
from app.models.sensor_reading import SensorReading
from app.services.prediction_service import is_threshold_breach, run_prediction


def ingest_reading(db: Session, equipment: Equipment, payload, trigger_prediction: bool = True) -> SensorReading:
    recorded_at = payload.recorded_at or datetime.now(timezone.utc)
    reading = SensorReading(
        equipment_id=equipment.id,
        recorded_at=recorded_at,
        temperature=payload.temperature,
        vibration=payload.vibration,
        pressure=payload.pressure,
        rpm=payload.rpm,
        current=payload.current,
        operating_hours=payload.operating_hours,
        source=payload.source,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    event_broker.publish("sensor.reading", {
        "id": reading.id, "equipment_id": equipment.id, "equipment_name": equipment.name,
        "recorded_at": reading.recorded_at.isoformat(), "temperature": reading.temperature,
        "vibration": reading.vibration, "pressure": reading.pressure, "rpm": reading.rpm,
        "current": reading.current, "operating_hours": reading.operating_hours,
    })
    values = {
        "temperature": reading.temperature, "vibration": reading.vibration,
        "pressure": reading.pressure, "rpm": reading.rpm, "current": reading.current,
        "operating_hours": reading.operating_hours,
    }
    if trigger_prediction and settings.event_trigger_enabled and is_threshold_breach(equipment, values):
        run_prediction(db, equipment.id, trigger_type="event")
    return reading
