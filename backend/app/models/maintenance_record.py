from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False, index=True)
    performed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    maintenance_type: Mapped[str] = mapped_column(String(80), default="preventive", nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    downtime_hours: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    performed_by: Mapped[str | None] = mapped_column(String(150), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    equipment = relationship("Equipment", back_populates="maintenance_records")
