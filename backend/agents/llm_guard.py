import asyncio
import contextvars
import os
import re
import time
from typing import Any
from agents.runtime_status import set_status


LLM_MIN_INTERVAL_SECONDS = float(os.getenv("LLM_MIN_INTERVAL_SECONDS", "0.5"))
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "4"))
LLM_RETRY_BASE_SECONDS = float(os.getenv("LLM_RETRY_BASE_SECONDS", "2"))

_llm_lock = asyncio.Lock()
_next_llm_allowed_at = 0.0
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
    # OpenAI often returns retry-after in headers, but langchain might put it in the message
    text = message.lower()
    
    # Try to find common patterns
    match = re.search(r"try again in ([0-9.]+)s", text)
    if match:
        return float(match.group(1))
    
    return None


async def _acquire_llm_slot() -> None:
    """Serialize LLM calls and enforce a minimum spacing between requests."""
    global _next_llm_allowed_at

    async with _llm_lock:
        now = time.monotonic()
        if now < _next_llm_allowed_at:
            wait_seconds = _next_llm_allowed_at - now
            user_id = _current_user_id.get()
            if user_id is not None and wait_seconds > 0.5:
                set_status(user_id, f"API pacing active. Retrying in {wait_seconds:.1f}s", wait_seconds)
            await asyncio.sleep(wait_seconds)

        _next_llm_allowed_at = time.monotonic() + max(0.1, LLM_MIN_INTERVAL_SECONDS)


async def guarded_llm_ainvoke(chain: Any, payload: dict[str, Any], timeout_seconds: float = 60.0) -> Any:
    """Invoke LLM chain with spacing + retry/backoff on rate-limit errors."""
    last_exc: Exception | None = None

    for attempt in range(LLM_MAX_RETRIES + 1):
        await _acquire_llm_slot()
        try:
            return await asyncio.wait_for(chain.ainvoke(payload), timeout=timeout_seconds)
        except Exception as exc:
            last_exc = exc
            message = str(exc)

            if not _is_rate_limit_error(message) or attempt >= LLM_MAX_RETRIES:
                raise

            retry_after = _extract_retry_after_seconds(message)
            fallback_wait = LLM_RETRY_BASE_SECONDS * (2 ** attempt)
            wait_seconds = retry_after if retry_after is not None else fallback_wait
            user_id = _current_user_id.get()
            if user_id is not None:
                set_status(
                    user_id,
                    f"Rate limited by API. Auto-retrying in {wait_seconds:.1f}s (attempt {attempt + 1}/{LLM_MAX_RETRIES})",
                    wait_seconds,
                )
            await asyncio.sleep(max(1.0, wait_seconds))

    raise last_exc if last_exc else RuntimeError("Unknown LLM invocation failure")
