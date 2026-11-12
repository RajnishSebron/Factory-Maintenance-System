from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.equipment import Equipment
from app.models.prediction import Prediction
from app.models.user import User
from app.schemas.prediction import PredictionOut
from app.services.prediction_service import run_prediction

router = APIRouter()


@router.get("", response_model=list[PredictionOut])
def list_predictions(equipment_id: int | None = None, limit: int = 100, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    query = select(Prediction).order_by(desc(Prediction.created_at))
    if equipment_id is not None:
        query = query.where(Prediction.equipment_id == equipment_id)
    return list(db.scalars(query.limit(max(1, min(limit, 500)))).all())


@router.post("/run/{equipment_id}", response_model=PredictionOut)
def manual_prediction(equipment_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("admin", "engineer"))):
    if not db.get(Equipment, equipment_id):
        raise HTTPException(status_code=404, detail="Equipment not found")
    result = run_prediction(db, equipment_id, trigger_type="manual")
    if not result:
        raise HTTPException(status_code=409, detail="No sensor readings available or equipment is inactive")
    return result
