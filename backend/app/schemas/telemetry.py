from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.common import ORMModel


class SensorReadingCreate(BaseModel):
    temperature: float = Field(ge=-50, le=500)
    vibration: float = Field(ge=0, le=1000)
    pressure: float = Field(ge=0, le=1000)
    rpm: float = Field(ge=0, le=100000)
    current: float = Field(ge=0, le=10000)
    operating_hours: float = Field(ge=0)
    recorded_at: datetime | None = None
    source: str = "api"


class SensorReadingOut(ORMModel):
    id: int
    equipment_id: int
    recorded_at: datetime
    temperature: float
    vibration: float
    pressure: float
    rpm: float
    current: float
    operating_hours: float
    source: str
