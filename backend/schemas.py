from pydantic import BaseModel, EmailStr
from typing import Optional, Any
from datetime import datetime


# ─── Auth Schemas ───
class RegisterResponse(BaseModel):
    message: str
    user_id: int
    unique_id: str
    username: str


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    unique_id: str
    username: str


class UserInfo(BaseModel):
    id: int
    unique_id: str
    email: str
    username: str
    resume_filename: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Pipeline Schemas ───
class PipelineRequest(BaseModel):
    user_id: int


class AgentResult(BaseModel):
    agent_name: str
    agent_description: str
    status: str
    output: Optional[Any] = None
    error: Optional[str] = None


class PipelineResponse(BaseModel):
    message: str
    results: list[AgentResult]
