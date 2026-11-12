from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.deps import require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserUpdate

router = APIRouter()


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    return list(db.scalars(select(User).order_by(User.created_at.desc())).all())


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    if payload.role not in {"admin", "engineer", "viewer"}:
        raise HTTPException(status_code=400, detail="Role must be admin, engineer, or viewer")
    email = payload.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Email is already registered")
    user = User(full_name=payload.full_name, email=email, hashed_password=hash_password(payload.password), role=payload.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    changes = payload.model_dump(exclude_unset=True)
    if "role" in changes and changes["role"] not in {"admin", "engineer", "viewer"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    for key, value in changes.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user
