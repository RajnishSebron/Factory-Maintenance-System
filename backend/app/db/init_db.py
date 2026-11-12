from app.db.base import Base
from app.db.session import engine
from app.models import user, equipment, sensor_reading, prediction, alert, maintenance_record, model_version  # noqa: F401


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    print("Database tables created (existing tables are preserved).")


if __name__ == "__main__":
    init_db()
