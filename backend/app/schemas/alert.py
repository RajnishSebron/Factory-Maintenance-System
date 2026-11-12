from datetime import datetime
from app.schemas.common import ORMModel


class AlertOut(ORMModel):
    id: int
    equipment_id: int
    prediction_id: int | None
    alert_type: str
    severity: str
    title: str
    message: str
    is_acknowledged: bool
    acknowledged_by_id: int | None
    acknowledged_at: datetime | None
    created_at: datetime
