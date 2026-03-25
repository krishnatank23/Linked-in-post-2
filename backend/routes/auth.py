import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta
from dotenv import load_dotenv

from database import get_db
from models import User
from schemas import LoginRequest, LoginResponse, RegisterResponse, UserInfo

load_dotenv()

router = APIRouter(prefix="/api", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-this")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/register", response_model=RegisterResponse)
async def register(
    email: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
    resume: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    # Check existing user
    result = await db.execute(select(User).where((User.email == email) | (User.username == username)))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User with this email or username already exists")

    # Save resume file
    file_ext = os.path.splitext(resume.filename)[1].lower()
    if file_ext not in [".pdf", ".doc", ".docx"]:
        raise HTTPException(status_code=400, detail="Only PDF, DOC, and DOCX files are allowed")

    import uuid
    unique_id = str(uuid.uuid4())
    safe_filename = f"{unique_id}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(resume.file, buffer)

    # Create user
    new_user = User(
        email=email,
        username=username,
        hashed_password=pwd_context.hash(password),
        resume_path=file_path,
        resume_filename=resume.filename,
        unique_id=unique_id,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return RegisterResponse(
        message="Registration successful",
        user_id=new_user.id,
        unique_id=new_user.unique_id,
        username=new_user.username,
    )


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if not user or not pwd_context.verify(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id), "email": user.email})

    return LoginResponse(
        access_token=token,
        user_id=user.id,
        unique_id=user.unique_id,
        username=user.username,
    )


@router.get("/user/{user_id}", response_model=UserInfo)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserInfo.model_validate(user)
