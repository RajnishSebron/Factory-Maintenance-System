from sqlalchemy import select
from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User


def create_admin() -> None:
    db = SessionLocal()
    try:
        existing = db.scalar(select(User).where(User.email == settings.admin_email.lower()))
        if existing:
            print(f"Admin account already exists: {settings.admin_email}")
            return
        user = User(
            full_name="System Administrator",
            email=settings.admin_email.lower(),
            hashed_password=hash_password(settings.admin_password),
            role="admin",
            is_active=True,
        )
        db.add(user)
        db.commit()
        print(f"Admin account created: {settings.admin_email}")
    finally:
        db.close()


if __name__ == "__main__":
    create_admin()
