import asyncio
import contextvars
import os
import re
import time
from typing import Any
from agents.runtime_status import set_status


GROQ_MIN_INTERVAL_SECONDS = float(os.getenv("GROQ_MIN_INTERVAL_SECONDS", "8"))
GROQ_MAX_RETRIES = int(os.getenv("GROQ_MAX_RETRIES", "4"))
GROQ_RETRY_BASE_SECONDS = float(os.getenv("GROQ_RETRY_BASE_SECONDS", "6"))

_groq_lock = asyncio.Lock()
_next_groq_allowed_at = 0.0
_current_user_id: contextvars.ContextVar[int | None] = contextvars.ContextVar("current_user_id", default=None)


def set_current_user_context(user_id: int | None) -> None:
    _current_user_id.set(user_id)


def _is_rate_limit_error(message: str) -> bool:
    msg = message.lower()
    return (
        "rate limit" in msg
        or "too many requests" in msg
        or "429" in msg
        or "quota" in msg
    )


def _extract_retry_after_seconds(message: str) -> float | None:
    text = message.lower()

    # Format example from Groq: "Please try again in 7m9.407999999s"
    detailed = re.search(
        r"try again in\s*(?:(?P<h>[0-9]+(?:\.[0-9]+)?)h)?\s*(?:(?P<m>[0-9]+(?:\.[0-9]+)?)m)?\s*(?:(?P<s>[0-9]+(?:\.[0-9]+)?)s)?",
        text,
    )
    if detailed:
        h = float(detailed.group("h") or 0)
        m = float(detailed.group("m") or 0)
        s = float(detailed.group("s") or 0)
        total = h * 3600 + m * 60 + s
        if total > 0:
            return total

    # Simpler format fallback: "try again in 12.5s"
    simple = re.search(r"try again in\s*([0-9]+(?:\.[0-9]+)?)s", text)
    if simple:
        try:
            return float(simple.group(1))
        except Exception:
            return None

    return None


async def _acquire_groq_slot() -> None:
    """Serialize Groq calls and enforce a minimum spacing between requests."""
    global _next_groq_allowed_at

    async with _groq_lock:
        now = time.monotonic()
        if now < _next_groq_allowed_at:
            wait_seconds = _next_groq_allowed_at - now
            user_id = _current_user_id.get()
            if user_id is not None:
                set_status(user_id, f"API limit protection active. Retrying in {wait_seconds:.1f}s", wait_seconds)
            await asyncio.sleep(wait_seconds)

        _next_groq_allowed_at = time.monotonic() + max(1.0, GROQ_MIN_INTERVAL_SECONDS)


async def guarded_groq_ainvoke(chain: Any, payload: dict[str, Any], timeout_seconds: float = 60.0) -> Any:
    """Invoke Groq chain with spacing + retry/backoff on rate-limit errors."""
    last_exc: Exception | None = None

    for attempt in range(GROQ_MAX_RETRIES + 1):
        await _acquire_groq_slot()
        try:
            return await asyncio.wait_for(chain.ainvoke(payload), timeout=timeout_seconds)
        except Exception as exc:
            last_exc = exc
            message = str(exc)

            if not _is_rate_limit_error(message) or attempt >= GROQ_MAX_RETRIES:
                raise

            retry_after = _extract_retry_after_seconds(message)
            fallback_wait = GROQ_RETRY_BASE_SECONDS * (2 ** attempt)
            wait_seconds = retry_after if retry_after is not None else fallback_wait
            user_id = _current_user_id.get()
            if user_id is not None:
                set_status(
                    user_id,
                    f"Rate limited by API. Auto-retrying in {wait_seconds:.1f}s (attempt {attempt + 1}/{GROQ_MAX_RETRIES})",
                    wait_seconds,
                )
            await asyncio.sleep(max(1.0, wait_seconds))

    raise last_exc if last_exc else RuntimeError("Unknown Groq invocation failure")
