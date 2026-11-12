from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.common import ORMModel


class EquipmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    asset_tag: str = Field(min_length=2, max_length=80)
    equipment_type: str = "Industrial machine"
    location: str | None = None
    criticality: str = "medium"
    status: str = "active"
    description: str | None = None
    thresholds: dict = Field(default_factory=lambda: {
        "temperature_max": 85.0, "vibration_max": 7.0, "pressure_min": 1.0,
        "pressure_max": 12.0, "current_max": 30.0,
    })
    installed_at: datetime | None = None


class EquipmentUpdate(BaseModel):
    name: str | None = None
    equipment_type: str | None = None
    location: str | None = None
    criticality: str | None = None
    status: str | None = None
    description: str | None = None
    thresholds: dict | None = None


class EquipmentOut(ORMModel):
    id: int
    name: str
    asset_tag: str
    equipment_type: str
    location: str | None
    criticality: str
    status: str
    description: str | None
    thresholds: dict
    installed_at: datetime | None
    created_at: datetime
