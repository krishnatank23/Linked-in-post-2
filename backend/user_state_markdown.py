from __future__ import annotations

import json
from pathlib import Path
from typing import Any


STATE_DIR = Path(__file__).resolve().parent / "user_state_snapshots"


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (dict, list)):
        return json.dumps(value, indent=2, ensure_ascii=True)
    return str(value)


def build_user_state_markdown(user: Any) -> str:
    """Build a human-readable markdown snapshot of the current user state."""
    created_at = _stringify(getattr(user, "created_at", None))
    cache_updated_at = _stringify(getattr(user, "cache_updated_at", None))
    last_automated_post_at = _stringify(getattr(user, "last_automated_post_at", None))

    sections = [
        f"# User State Snapshot\n",
        f"- User ID: {_stringify(getattr(user, 'id', None))}",
        f"- Unique ID: {_stringify(getattr(user, 'unique_id', None))}",
        f"- Email: {_stringify(getattr(user, 'email', None))}",
        f"- Username: {_stringify(getattr(user, 'username', None))}",
        f"- Resume Filename: {_stringify(getattr(user, 'resume_filename', None)) or 'None'}",
        f"- Resume Path: {_stringify(getattr(user, 'resume_path', None)) or 'None'}",
        f"- Created At: {created_at or 'Unknown'}",
        f"- Cache Updated At: {cache_updated_at or 'None'}",
        f"- Posting Schedule: {_stringify(getattr(user, 'posting_schedule', None)) or 'None'}",
        f"- Posting Time UTC: {_stringify(getattr(user, 'posting_time_utc', None)) or 'None'}",
        f"- Last Automated Post At: {last_automated_post_at or 'None'}",
        "",
        "## Cached Profile",
        f"```json\n{_stringify(getattr(user, 'parsed_profile_cache', None)) or 'null'}\n```",
        "",
        "## Cached Brand Voice",
        f"```json\n{_stringify(getattr(user, 'brand_voice_cache', None)) or 'null'}\n```",
        "",
        "## Notes",
        "This snapshot is regenerated on registration and login.",
        "It remains until the user state is reset or the snapshot file is deleted.",
    ]

    return "\n".join(sections).strip() + "\n"


def write_user_state_markdown(user: Any) -> Path:
    """Write the current user state to a per-user markdown snapshot file."""
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    unique_id = _stringify(getattr(user, "unique_id", None)) or f"user-{_stringify(getattr(user, 'id', 'unknown'))}"
    snapshot_path = STATE_DIR / f"{unique_id}.md"
    snapshot_path.write_text(build_user_state_markdown(user), encoding="utf-8")
    return snapshot_path


def delete_user_state_markdown(user: Any) -> None:
    """Delete the snapshot file for a user when a manual reset is needed."""
    unique_id = _stringify(getattr(user, "unique_id", None)) or f"user-{_stringify(getattr(user, 'id', 'unknown'))}"
    snapshot_path = STATE_DIR / f"{unique_id}.md"
    if snapshot_path.exists():
        snapshot_path.unlink()