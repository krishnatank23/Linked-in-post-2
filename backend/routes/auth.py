import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta
from env_config import load_backend_env

from database import get_db
from models import User
from schemas import LoginRequest, LoginResponse, RegisterResponse, UserInfo
from path_resolver import to_portable_resume_path

try:
    import bcrypt as bcrypt_lib
except Exception:
    bcrypt_lib = None

load_backend_env()

router = APIRouter(prefix="/api", tags=["auth"])

# Use PBKDF2 by default for new passwords; keep bcrypt for legacy hash verification.
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-this")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


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


async def verify_password_and_migrate(password: str, user: User, db: AsyncSession) -> bool:
    """Verify password robustly and migrate legacy hashes to current scheme."""
    hashed_password = user.hashed_password or ""

    try:
        is_valid = pwd_context.verify(password, hashed_password)
    except Exception:
        # Fallback for legacy bcrypt hashes when passlib's bcrypt backend is unavailable.
        is_valid = False
        if bcrypt_lib is not None and hashed_password.startswith("$2"):
            try:
                is_valid = bcrypt_lib.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
            except Exception:
                is_valid = False

    if not is_valid:
        return False

    try:
        if pwd_context.needs_update(hashed_password):
            user.hashed_password = pwd_context.hash(password)
            await db.commit()
    except Exception:
        # Do not block successful logins if migration fails.
        pass

    return True


@router.post("/register", response_model=RegisterResponse)
async def register(
    email: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
    resume: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    email = _normalize_email(email)
    username = (username or "").strip()

    if not password:
        raise HTTPException(status_code=400, detail="Password cannot be empty")
    # Check existing user
    try:
        existing_email_result = await db.execute(select(User).where(User.email == email))
        existing_email_user = existing_email_result.scalar_one_or_none()

        existing_username_user = None
        if username:
            existing_username_result = await db.execute(select(User).where(User.username == username))
            existing_username_user = existing_username_result.scalar_one_or_none()

        if existing_username_user and existing_email_user is None and existing_username_user.email != email:
            raise HTTPException(status_code=400, detail="Username already exists. Choose a different username.")

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

        portable_resume_path = to_portable_resume_path(file_path)

        # Create new user or update the existing account for this email.
        hashed_pw = pwd_context.hash(password)

        if existing_email_user:
            existing_email_user.username = username or existing_email_user.username
            existing_email_user.hashed_password = hashed_pw
            existing_email_user.resume_path = portable_resume_path
            existing_email_user.resume_filename = resume.filename
            new_user = existing_email_user
        else:
            new_user = User(
                email=email,
                username=username,
                hashed_password=hashed_pw,
                resume_path=portable_resume_path,
                resume_filename=resume.filename,
                unique_id=unique_id,
            )
            db.add(new_user)

        await db.commit()
        await db.refresh(new_user)

        return RegisterResponse(
            message="Registration successful" if not existing_email_user else "Account updated successfully",
            user_id=new_user.id,
            unique_id=new_user.unique_id,
            username=new_user.username,
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        print(f"Error in registration: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Registration error: {str(e)}")


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    email = _normalize_email(request.email)
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not request.password:
        raise HTTPException(status_code=400, detail="Password cannot be empty")

    if not user:
        raise HTTPException(status_code=404, detail="No account found for this email. Please sign up first.")

    is_valid = await verify_password_and_migrate(request.password, user, db)
    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid password")

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
