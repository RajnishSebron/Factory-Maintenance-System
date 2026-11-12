
from datetime import datetime, timedelta, timezone
from pathlib import Path

import joblib
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.config import settings
from app.db.session import get_db
from app.models.prediction import Prediction
from app.models.user import User


router = APIRouter()


def get_artifact_summary(filename: str) -> dict:
    """
    Read model version and training metrics from a saved
    Joblib artifact without exposing the model object.
    """
    artifact_path = Path(settings.artifacts_dir) / filename

    if not artifact_path.exists():
        return {
            "status": "not_found",
            "version": None,
            "metrics": {},
            "feature_count": 0
        }

    try:
        bundle = joblib.load(artifact_path)

        return {
            "status": "loaded",
            "version": bundle.get("version"),
            "metrics": bundle.get("metrics", {}),
            "feature_count": len(bundle.get("features", []))
        }

    except Exception:
        return {
            "status": "unreadable",
            "version": None,
            "metrics": {},
            "feature_count": 0
        }


def get_version_counts(db: Session, model_column, cutoff: datetime) -> dict:
    """
    Count predictions grouped by the model version
    recorded in the prediction table.
    """
    rows = db.execute(
        select(
            model_column,
            func.count(Prediction.id)
        )
        .where(Prediction.created_at >= cutoff)
        .group_by(model_column)
    ).all()

    return {
        str(version or "unknown"): int(count)
        for version, count in rows
    }


@router.get("/summary")
def get_model_monitoring_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "engineer"))
):
    """
    Return offline training metrics and recent
    prediction activity for both ML models.
    """

    now = datetime.now(timezone.utc)

    # MySQL DateTime columns may be stored without timezone data.
    cutoff = (now - timedelta(days=30)).replace(tzinfo=None)

    # Load the saved model evaluation reports.
    failure_model = get_artifact_summary(
        "failure_model.joblib"
    )

    rul_model = get_artifact_summary(
        "rul_model.joblib"
    )

    # Calculate prediction activity over the last 30 days.
    result = db.execute(
        select(
            func.count(Prediction.id),
            func.avg(Prediction.failure_probability),
            func.avg(Prediction.rul_hours)
        )
        .where(Prediction.created_at >= cutoff)
    ).one()

    total_predictions = int(result[0] or 0)

    avg_failure_probability = (
        float(result[1]) if result[1] is not None else None
    )

    avg_rul_hours = (
        float(result[2]) if result[2] is not None else None
    )

    # Count predictions that used fallback calculations.
    failure_fallback_count = db.scalar(
        select(func.count(Prediction.id))
        .where(
            Prediction.created_at >= cutoff,
            Prediction.failure_model_version == "fallback"
        )
    ) or 0

    rul_fallback_count = db.scalar(
        select(func.count(Prediction.id))
        .where(
            Prediction.created_at >= cutoff,
            Prediction.rul_model_version == "fallback"
        )
    ) or 0

    # Compare usage across recorded model versions.
    failure_version_counts = get_version_counts(
        db,
        Prediction.failure_model_version,
        cutoff
    )

    rul_version_counts = get_version_counts(
        db,
        Prediction.rul_model_version,
        cutoff
    )

    return {
        "generated_at": now.isoformat(),

        "period_days": 30,

        "failure_prediction_model": failure_model,

        "rul_model": rul_model,

        "runtime": {
            "total_predictions": total_predictions,

            "average_failure_probability": (
                round(avg_failure_probability, 4)
                if avg_failure_probability is not None
                else None
            ),

            "average_rul_hours": (
                round(avg_rul_hours, 2)
                if avg_rul_hours is not None
                else None
            ),

            "failure_fallback_predictions": int(
                failure_fallback_count
            ),

            "rul_fallback_predictions": int(
                rul_fallback_count
            ),

            "failure_model_version_counts": (
                failure_version_counts
            ),

            "rul_model_version_counts": (
                rul_version_counts
            )
        },

        "configuration": {
            "failure_horizon_hours": (
                settings.failure_horizon_hours
            ),

            "prediction_interval_minutes": (
                settings.prediction_interval_minutes
            ),

            "alert_failure_probability": (
                settings.alert_failure_probability
            )
        }
    }
