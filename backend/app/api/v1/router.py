from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    users,
    equipment,
    telemetry,
    predictions,
    alerts,
    maintenance,
    dashboard,
    events,
    model_monitoring
)
api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(equipment.router, prefix="/equipment", tags=["Equipment"])
api_router.include_router(telemetry.router, prefix="/telemetry", tags=["Telemetry"])
api_router.include_router(predictions.router, prefix="/predictions", tags=["Predictions"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])
api_router.include_router(maintenance.router, prefix="/maintenance", tags=["Maintenance"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(events.router, prefix="/events", tags=["Events"])
api_router.include_router(model_monitoring.router, prefix="/model-monitoring", tags=["Model Monitoring"])