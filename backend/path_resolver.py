import os
import re

# Backend root directory (directory containing this file)
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)

# Legacy and current upload locations to probe.
UPLOAD_DIR_CANDIDATES = [
    os.path.join(BACKEND_DIR, "routes", "uploads"),
    os.path.join(BACKEND_DIR, "uploads"),
]

WINDOWS_ABS_PATH_RE = re.compile(r"^[A-Za-z]:[\\/]")


def _normalize_slashes(path: str) -> str:
    return path.replace("\\", "/")


def resolve_resume_path(raw_path: str) -> str:
    """Resolve a persisted resume path to an existing file on the current machine.

    Supports:
    - Native absolute paths on current OS
    - Relative paths stored in DB (preferred)
    - Legacy Windows absolute paths when running on Linux (fallback by basename)
    """
    if not raw_path:
        raise FileNotFoundError("Resume path is empty")

    raw_path = str(raw_path).strip().strip('"').strip("'")
    basename = os.path.basename(raw_path.replace("\\", "/"))

    candidates = []

    # 1) Path as stored.
    candidates.append(raw_path)

    # 2) If stored path is relative, resolve against backend/project roots.
    if not os.path.isabs(raw_path) and not WINDOWS_ABS_PATH_RE.match(raw_path):
        candidates.append(os.path.join(BACKEND_DIR, raw_path))
        candidates.append(os.path.join(PROJECT_ROOT, raw_path))

    # 3) Probe known upload dirs by filename (handles cross-machine absolute path mismatch).
    if basename:
        for upload_dir in UPLOAD_DIR_CANDIDATES:
            candidates.append(os.path.join(upload_dir, basename))

    for candidate in candidates:
        normalized = os.path.normpath(candidate)
        if os.path.exists(normalized) and os.path.isfile(normalized):
            return normalized

    attempted = [os.path.normpath(p) for p in candidates]
    raise FileNotFoundError(
        "Resume file not found. Stored path: "
        f"{raw_path}. Attempted: {attempted}"
    )


def to_portable_resume_path(resolved_abs_path: str) -> str:
    """Return a stable, cross-environment relative path for DB persistence when possible."""
    abs_path = os.path.abspath(resolved_abs_path)
    backend_root = os.path.abspath(BACKEND_DIR)

    try:
        common = os.path.commonpath([abs_path, backend_root])
    except ValueError:
        common = ""

    if common == backend_root:
        rel = os.path.relpath(abs_path, backend_root)
        return _normalize_slashes(rel)

    return _normalize_slashes(abs_path)
