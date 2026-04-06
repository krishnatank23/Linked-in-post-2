import os
from dotenv import load_dotenv


def load_backend_env() -> None:
    """Load environment variables from backend/.env regardless of current working directory."""
    backend_dir = os.path.dirname(__file__)
    env_path = os.path.join(backend_dir, ".env")
    # override=True prevents empty inherited vars from masking real .env values.
    load_dotenv(env_path, override=True)
