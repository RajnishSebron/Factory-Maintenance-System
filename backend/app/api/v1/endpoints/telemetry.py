from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.equipment import Equipment
from app.models.sensor_reading import SensorReading
from app.models.user import User
from app.schemas.telemetry import SensorReadingCreate, SensorReadingOut
from app.services.telemetry_service import ingest_reading

router = APIRouter()


@router.post("/{equipment_id}", response_model=SensorReadingOut, status_code=status.HTTP_201_CREATED)
def ingest_telemetry(equipment_id: int, payload: SensorReadingCreate, db: Session = Depends(get_db), _: User = Depends(require_roles("admin", "engineer"))):
    equipment = db.get(Equipment, equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    if equipment.status != "active":
        raise HTTPException(status_code=409, detail="Cannot ingest readings for inactive equipment")
    return ingest_reading(db, equipment, payload)


@router.get("/{equipment_id}/latest", response_model=SensorReadingOut)
def latest_reading(equipment_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    reading = db.scalar(select(SensorReading).where(SensorReading.equipment_id == equipment_id).order_by(desc(SensorReading.recorded_at)))
    if not reading:
        raise HTTPException(status_code=404, detail="No readings found for equipment")
    return reading


@router.get("/{equipment_id}/history", response_model=list[SensorReadingOut])
def reading_history(equipment_id: int, limit: int = 100, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if not db.get(Equipment, equipment_id):
        raise HTTPException(status_code=404, detail="Equipment not found")
    limit = max(1, min(limit, 1000))
    return list(db.scalars(select(SensorReading).where(SensorReading.equipment_id == equipment_id).order_by(desc(SensorReading.recorded_at)).limit(limit)).all())
