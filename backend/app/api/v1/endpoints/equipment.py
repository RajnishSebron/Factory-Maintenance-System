from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.equipment import Equipment
from app.models.user import User
from app.schemas.equipment import EquipmentCreate, EquipmentOut, EquipmentUpdate

router = APIRouter()


@router.get("", response_model=list[EquipmentOut])
def list_equipment(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return list(db.scalars(select(Equipment).order_by(Equipment.name)).all())


@router.post("", response_model=EquipmentOut, status_code=status.HTTP_201_CREATED)
def create_equipment(payload: EquipmentCreate, db: Session = Depends(get_db), _: User = Depends(require_roles("admin", "engineer"))):
    if db.scalar(select(Equipment).where(Equipment.asset_tag == payload.asset_tag)):
        raise HTTPException(status_code=409, detail="Asset tag already exists")
    if payload.criticality not in {"low", "medium", "high", "critical"}:
        raise HTTPException(status_code=400, detail="Invalid criticality")
    equipment = Equipment(**payload.model_dump())
    db.add(equipment)
    db.commit()
    db.refresh(equipment)
    return equipment


@router.get("/{equipment_id}", response_model=EquipmentOut)
def get_equipment(equipment_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    equipment = db.get(Equipment, equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return equipment


@router.patch("/{equipment_id}", response_model=EquipmentOut)
def update_equipment(equipment_id: int, payload: EquipmentUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles("admin", "engineer"))):
    equipment = db.get(Equipment, equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(equipment, key, value)
    db.commit()
    db.refresh(equipment)
    return equipment


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment(equipment_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    equipment = db.get(Equipment, equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    db.delete(equipment)
    db.commit()
