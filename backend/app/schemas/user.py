from pydantic import BaseModel, EmailStr, Field
from app.schemas.common import ORMModel


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    role: str = "viewer"


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    role: str | None = None
    is_active: bool | None = None


class UserOut(ORMModel):
    id: int
    full_name: str
    email: str
    role: str
    is_active: bool
