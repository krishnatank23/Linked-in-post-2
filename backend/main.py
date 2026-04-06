import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from env_config import load_backend_env

load_backend_env()

from database import init_db
from routes.auth import router as auth_router
from routes.pipeline import router as pipeline_router
from scheduler import start_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create database tables
    await init_db()
    # Startup: Initialize the automated posting scheduler
    start_scheduler()
    yield
    # Shutdown: nothing to clean up


app = FastAPI(
    title="LinkedIn Personal Branding Assistant",
    description="Agentic AI pipeline for resume analysis and personal brand generation",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(auth_router)
app.include_router(pipeline_router)

# Serve built React app only when explicitly enabled for production.
serve_frontend = os.getenv("SERVE_REACT_BUILD", "0") == "1"
if serve_frontend:
    frontend_dir = os.path.join(os.path.dirname(__file__), "..", "brandforge-react", "dist")
    if os.path.exists(frontend_dir):
        app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
