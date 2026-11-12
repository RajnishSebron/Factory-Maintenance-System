from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.equipment import Equipment
from app.models.maintenance_record import MaintenanceRecord
from app.models.user import User
from app.schemas.maintenance import MaintenanceCreate, MaintenanceOut

router = APIRouter()


@router.get("", response_model=list[MaintenanceOut])
def list_maintenance(equipment_id: int | None = None, limit: int = 100, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    query = select(MaintenanceRecord).order_by(desc(MaintenanceRecord.performed_at))
    if equipment_id is not None:
        query = query.where(MaintenanceRecord.equipment_id == equipment_id)
    return list(db.scalars(query.limit(max(1, min(limit, 500)))).all())


@router.post("", response_model=MaintenanceOut, status_code=status.HTTP_201_CREATED)
def create_maintenance(payload: MaintenanceCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin", "engineer"))):
    if not db.get(Equipment, payload.equipment_id):
        raise HTTPException(status_code=404, detail="Equipment not found")
    values = payload.model_dump()
    if not values.get("performed_by"):
        values["performed_by"] = current_user.full_name
    record = MaintenanceRecord(**values)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
