"""Week helpers. Weeks are ISO weeks identified by their Monday (date)."""
from __future__ import annotations

from datetime import date, timedelta

WEEKS_OF_HISTORY = 26  # rolling six months


def monday_of(day: date) -> date:
    return day - timedelta(days=day.weekday())


def week_mondays(now: date, n: int = WEEKS_OF_HISTORY) -> list[date]:
    """The last `n` Mondays, oldest first, including the current (in-progress) week."""
    current = monday_of(now)
    return [current - timedelta(weeks=(n - 1 - i)) for i in range(n)]


def current_week_start(now: date) -> date:
    return monday_of(now)


def previous_week_start(now: date) -> date:
    return monday_of(now) - timedelta(weeks=1)
