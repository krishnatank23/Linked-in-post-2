import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    unique_id = Column(String(36), default=lambda: str(uuid.uuid4()), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    resume_path = Column(String(500), nullable=True)
    resume_filename = Column(String(255), nullable=True)
    # Persistent cache so early agent outputs can be revisited without rerunning everything.
    parsed_profile_cache = Column(JSON, nullable=True)
    brand_voice_cache = Column(JSON, nullable=True)
    cache_updated_at = Column(DateTime, nullable=True)
    
    # Automated Posting Schedule
    posting_schedule = Column(JSON, nullable=True)  # e.g. ["Monday", "Thursday"]
    posting_time_utc = Column(String(10), nullable=True)  # e.g. "14:00"
    last_automated_post_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    agent_outputs = relationship("AgentOutput", back_populates="user", cascade="all, delete-orphan")


class AgentOutput(Base):
    __tablename__ = "agent_outputs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    agent_name = Column(String(100), nullable=False)
    agent_description = Column(String(500), nullable=True)
    status = Column(String(20), default="pending")  # pending, running, success, error
    output_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    is_saved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="agent_outputs")
