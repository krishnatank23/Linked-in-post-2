import re
from typing import Any

WEEKDAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]

_WEEKDAY_LOOKUP = {day.lower(): day for day in WEEKDAYS}


def normalize_posting_schedule(
    schedule_days: Any,
    fallback: list[str] | None = None,
) -> list[str]:
    """Normalize user/model-provided day names to Title Case weekday names."""
    normalized: list[str] = []
    seen = set()

    if isinstance(schedule_days, (list, tuple)):
        for raw_day in schedule_days:
            canonical = _WEEKDAY_LOOKUP.get(str(raw_day or "").strip().lower())
            if canonical and canonical not in seen:
                seen.add(canonical)
                normalized.append(canonical)

    if normalized:
        return normalized

    if fallback is None:
        return ["Monday", "Wednesday", "Friday"]
    return list(fallback)


def _parse_posts_per_week(frequency_text: Any) -> int | None:
    text = str(frequency_text or "").strip().lower()
    if not text:
        return None

    match = re.search(r"(\d+)", text)
    if not match:
        return None

    try:
        return int(match.group(1))
    except ValueError:
        return None


def _days_for_posts_per_week(posts_per_week: int | None) -> list[str]:
    mapping = {
        1: ["Wednesday"],
        2: ["Monday", "Thursday"],
        3: ["Monday", "Wednesday", "Friday"],
        4: ["Monday", "Tuesday", "Thursday", "Friday"],
        5: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        6: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        7: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    }
    return mapping.get(posts_per_week or 0, ["Monday", "Wednesday", "Friday"])


def pick_posting_schedule(
    post_output: dict[str, Any] | None,
    gap_analysis: dict[str, Any] | None = None,
) -> list[str]:
    """Pick the best schedule from post output, gap strategy, or posting frequency fallback."""
    post_output = post_output or {}
    gap_analysis = gap_analysis or {}

    # 1) Prefer explicit model-selected schedule days.
    explicit_days = normalize_posting_schedule(post_output.get("posting_schedule_days"), fallback=[])
    if explicit_days:
        return explicit_days

    # 2) Fall back to strategy-recommended days from gap analysis.
    strategy_days = (
        (gap_analysis.get("overall_content_strategy") or {}).get("recommended_days")
        or (gap_analysis.get("content_strategy") or {}).get("recommended_days")
        or []
    )
    normalized_strategy_days = normalize_posting_schedule(strategy_days, fallback=[])
    if normalized_strategy_days:
        return normalized_strategy_days

    # 3) Infer from posting frequency if day list is absent.
    posts_per_week = _parse_posts_per_week(post_output.get("posting_frequency"))
    return _days_for_posts_per_week(posts_per_week)


def normalize_posting_time_utc(raw_time: Any, fallback: str = "11:00") -> str:
    """Validate HH:MM (24h) or return fallback."""
    value = str(raw_time or "").strip()
    if re.fullmatch(r"([01]\d|2[0-3]):([0-5]\d)", value):
        return value
    return fallback
