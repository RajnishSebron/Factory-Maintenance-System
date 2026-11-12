from apscheduler.schedulers.background import BackgroundScheduler
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.equipment import Equipment
from app.services.prediction_service import run_prediction

_scheduler: BackgroundScheduler | None = None


def run_scheduled_predictions() -> None:
    db = SessionLocal()
    try:
        equipment_ids = [row.id for row in db.query(Equipment.id).filter(Equipment.status == "active").all()]
        for equipment_id in equipment_ids:
            try:
                run_prediction(db, equipment_id, trigger_type="scheduled")
            except Exception as exc:
                db.rollback()
                print(f"Prediction failed for equipment {equipment_id}: {exc}")
    finally:
        db.close()


def start_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        run_scheduled_predictions,
        trigger="interval",
        minutes=settings.prediction_interval_minutes,
        id="scheduled-predictions",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
