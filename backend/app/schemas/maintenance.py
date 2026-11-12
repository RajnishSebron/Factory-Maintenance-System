from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.common import ORMModel


class MaintenanceCreate(BaseModel):
    equipment_id: int
    performed_at: datetime
    maintenance_type: str = "preventive"
    description: str = Field(min_length=3)
    downtime_hours: float = Field(default=0.0, ge=0)
    performed_by: str | None = None


class MaintenanceOut(ORMModel):
    id: int
    equipment_id: int
    performed_at: datetime
    maintenance_type: str
    description: str
    downtime_hours: float
    performed_by: str | None
    created_at: datetime
