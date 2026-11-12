from datetime import datetime
from sqlalchemy import DateTime, Float, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


DEFAULT_THRESHOLDS = {
    "temperature_max": 85.0,
    "vibration_max": 7.0,
    "pressure_min": 1.0,
    "pressure_max": 12.0,
    "current_max": 30.0,
}


class Equipment(Base):
    __tablename__ = "equipment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    asset_tag: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    equipment_type: Mapped[str] = mapped_column(String(100), default="Industrial machine", nullable=False)
    location: Mapped[str | None] = mapped_column(String(150), nullable=True)
    criticality: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    thresholds: Mapped[dict] = mapped_column(JSON, default=lambda: DEFAULT_THRESHOLDS.copy(), nullable=False)
    installed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    sensor_readings = relationship("SensorReading", back_populates="equipment", cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="equipment", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="equipment", cascade="all, delete-orphan")
    maintenance_records = relationship("MaintenanceRecord", back_populates="equipment", cascade="all, delete-orphan")
