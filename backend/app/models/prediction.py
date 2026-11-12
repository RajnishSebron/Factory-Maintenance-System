from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    horizon_hours: Mapped[int] = mapped_column(Integer, default=24, nullable=False)
    failure_probability: Mapped[float] = mapped_column(Float, nullable=False)
    failure_within_horizon: Mapped[bool] = mapped_column(Boolean, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    rul_hours: Mapped[float] = mapped_column(Float, nullable=False)
    failure_model_version: Mapped[str] = mapped_column(String(80), default="fallback", nullable=False)
    rul_model_version: Mapped[str] = mapped_column(String(80), default="fallback", nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(30), default="scheduled", nullable=False)
    feature_snapshot: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    equipment = relationship("Equipment", back_populates="predictions")
    alerts = relationship("Alert", back_populates="prediction")
