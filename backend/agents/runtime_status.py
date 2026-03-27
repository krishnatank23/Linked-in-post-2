from __future__ import annotations

import time
from threading import Lock

_status_lock = Lock()
_status_by_user: dict[int, dict] = {}


def set_status(user_id: int, message: str, wait_seconds: float | None = None) -> None:
    with _status_lock:
        _status_by_user[user_id] = {
            "message": message,
            "wait_seconds": None if wait_seconds is None else float(wait_seconds),
            "updated_at": time.time(),
        }


def clear_status(user_id: int) -> None:
    with _status_lock:
        _status_by_user.pop(user_id, None)


def get_status(user_id: int) -> dict:
    with _status_lock:
        status = _status_by_user.get(user_id)
        if not status:
            return {"active": False, "message": None, "wait_seconds": None}

        age = time.time() - status["updated_at"]
        remaining = None
        if status.get("wait_seconds") is not None:
            remaining = max(0.0, status["wait_seconds"] - age)

        is_active = remaining is None or remaining > 0
        return {
            "active": is_active,
            "message": status.get("message"),
            "wait_seconds": remaining,
        }
