from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class SensorReading(Base):
    __tablename__ = "sensor_readings"
    __table_args__ = (Index("ix_sensor_equipment_recorded", "equipment_id", "recorded_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False, index=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    temperature: Mapped[float] = mapped_column(Float, nullable=False)
    vibration: Mapped[float] = mapped_column(Float, nullable=False)
    pressure: Mapped[float] = mapped_column(Float, nullable=False)
    rpm: Mapped[float] = mapped_column(Float, nullable=False)
    current: Mapped[float] = mapped_column(Float, nullable=False)
    operating_hours: Mapped[float] = mapped_column(Float, nullable=False)
    source: Mapped[str] = mapped_column(String(40), default="simulator", nullable=False)

    equipment = relationship("Equipment", back_populates="sensor_readings")
