from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.events.broker import event_broker
from app.models.alert import Alert
from app.models.user import User
from app.schemas.alert import AlertOut

router = APIRouter()


@router.get("", response_model=list[AlertOut])
def list_alerts(unacknowledged_only: bool = False, limit: int = 100, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    query = select(Alert).order_by(desc(Alert.created_at))
    if unacknowledged_only:
        query = query.where(Alert.is_acknowledged.is_(False))
    return list(db.scalars(query.limit(max(1, min(limit, 500)))).all())


@router.patch("/{alert_id}/acknowledge", response_model=AlertOut)
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin", "engineer"))):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_acknowledged = True
    alert.acknowledged_by_id = current_user.id
    alert.acknowledged_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    event_broker.publish("alert.acknowledged", {"id": alert.id, "equipment_id": alert.equipment_id, "acknowledged_by": current_user.full_name})
    return alert
