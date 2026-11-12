from datetime import datetime
from app.schemas.common import ORMModel


class PredictionOut(ORMModel):
    id: int
    equipment_id: int
    created_at: datetime
    horizon_hours: int
    failure_probability: float
    failure_within_horizon: bool
    risk_level: str
    rul_hours: float
    failure_model_version: str
    rul_model_version: str
    trigger_type: str
    feature_snapshot: dict
