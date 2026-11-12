from datetime import datetime
from sqlalchemy import Boolean, DateTime, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    model_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(80), nullable=False)
    artifact_path: Mapped[str] = mapped_column(String(500), nullable=False)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
