from datetime import datetime, timedelta


def compute_scheduled_date(now: datetime, scheduled_day_name: str, posting_time_utc: str = "11:00") -> datetime:
    """Mirror scheduling logic used in workflow.save_posts_to_db_node."""
    day_mapping = {
        "Monday": 0,
        "Tuesday": 1,
        "Wednesday": 2,
        "Thursday": 3,
        "Friday": 4,
        "Saturday": 5,
        "Sunday": 6,
    }

    if scheduled_day_name not in day_mapping:
        raise ValueError(f"Invalid day name: {scheduled_day_name}")

    current_day = now.weekday()
    scheduled_day_num = day_mapping[scheduled_day_name]
    hour, minute = map(int, posting_time_utc.split(":"))

    days_until = (scheduled_day_num - current_day) % 7

    # Same-day safeguard: if today's slot already passed, push to next week.
    if days_until == 0:
        candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if now > candidate:
            days_until = 7

    scheduled_date = (now + timedelta(days=days_until)).replace(
        hour=hour,
        minute=minute,
        second=0,
        microsecond=0,
    )
    return scheduled_date


def run_tests() -> None:
    # Fixed reference: Monday, 2026-04-06
    monday = datetime(2026, 4, 6)

    # 1) Same day BEFORE posting time -> should schedule today.
    now = monday.replace(hour=9, minute=30)
    result = compute_scheduled_date(now, "Monday", "11:00")
    assert result == monday.replace(hour=11, minute=0, second=0, microsecond=0), (
        "Expected same-day scheduling before slot time"
    )

    # 2) Same day AFTER posting time -> should schedule next Monday (+7 days).
    now = monday.replace(hour=12, minute=0)
    result = compute_scheduled_date(now, "Monday", "11:00")
    assert result == (monday + timedelta(days=7)).replace(hour=11, minute=0, second=0, microsecond=0), (
        "Expected next-week scheduling when today's slot has passed"
    )

    # 3) Future day in same week (Thursday from Monday) -> +3 days.
    now = monday.replace(hour=8, minute=0)
    result = compute_scheduled_date(now, "Thursday", "11:00")
    assert result == (monday + timedelta(days=3)).replace(hour=11, minute=0, second=0, microsecond=0), (
        "Expected scheduling on upcoming Thursday"
    )

    # 4) Past day relative to current week (Sunday from Monday) -> +6 days.
    now = monday.replace(hour=8, minute=0)
    result = compute_scheduled_date(now, "Sunday", "11:00")
    assert result == (monday + timedelta(days=6)).replace(hour=11, minute=0, second=0, microsecond=0), (
        "Expected scheduling on upcoming Sunday"
    )

    # 5) Invalid day should raise.
    try:
        compute_scheduled_date(monday, "Funday", "11:00")
        raise AssertionError("Expected ValueError for invalid day name")
    except ValueError:
        pass

    print("All schedule-math tests passed.")


if __name__ == "__main__":
    run_tests()
