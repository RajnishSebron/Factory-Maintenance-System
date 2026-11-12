from pydantic import BaseModel, EmailStr, Field
from app.schemas.common import ORMModel


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORMModel):
    id: int
    full_name: str
    email: str
    role: str
    is_active: bool


class TokenResponse(BaseModel):
    message: str
    user: UserOut
