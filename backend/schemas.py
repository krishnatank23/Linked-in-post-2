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
    id: Optional[int] = None
    agent_name: str
    agent_description: str
    status: str
    output: Optional[Any] = None
    error: Optional[str] = None
    is_saved: bool = False


class PipelineResponse(BaseModel):
    message: str
    results: list[AgentResult]


# ─── Gap Analysis Schemas ───
class GapAnalysisRequest(BaseModel):
    user_id: int
    influencer_data: dict | list[dict]


class GapAnalysisResponse(BaseModel):
    message: str
    results: list[AgentResult]


class GeneratePostsRequest(BaseModel):
    user_id: int
    gap_analysis_data: dict


class SendReminderRequest(BaseModel):
    user_id: int
    posts_data: dict


# ─── Step-by-Step Pipeline Schemas ───
class StepResumeParserRequest(BaseModel):
    user_id: int


class StepBrandVoiceRequest(BaseModel):
    user_id: int
    parsed_profile: dict


class StepInfluencerScoutRequest(BaseModel):
    user_id: int
    parsed_profile: dict
    brand_voice: dict


class StepResponse(BaseModel):
    message: str
    result: AgentResult


# ─── Save Result Schemas ───
class SaveResultRequest(BaseModel):
    user_id: int
    agent_name: str
    save: bool = True
