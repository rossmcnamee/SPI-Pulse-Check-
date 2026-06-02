"""North Star milestone curve and the red/orange/green status system.

North Star: 100 new patients/week by end of December 2026 (currently ~60).
Monthly end-of-month milestone anchors are interpolated linearly by day so the
banner can show a target for *this* week, not just month boundaries.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

GOAL = 100

# End-of-month milestone anchors. End-of-May 2026 = 60 is the current baseline.
MILESTONE_ANCHORS: list[tuple[date, float]] = [
    (date(2026, 5, 31), 60),
    (date(2026, 6, 30), 66),
    (date(2026, 7, 31), 72),
    (date(2026, 8, 31), 78),
    (date(2026, 9, 30), 84),
    (date(2026, 10, 31), 90),
    (date(2026, 11, 30), 95),
    (date(2026, 12, 31), 100),
]

# Status colours (shared with the frontend).
RED = "red"        # off track  - below the current milestone
ORANGE = "orange"  # on track   - similar to the previous period
GREEN = "green"    # doing better than the previous period

FLAT_BAND = 0.02  # within +/-2% of prior period counts as "similar".


def milestone_for(day: date) -> float:
    """Interpolated weekly new-patient target for a given date."""
    if day <= MILESTONE_ANCHORS[0][0]:
        return MILESTONE_ANCHORS[0][1]
    if day >= MILESTONE_ANCHORS[-1][0]:
        return MILESTONE_ANCHORS[-1][1]
    for (d0, v0), (d1, v1) in zip(MILESTONE_ANCHORS, MILESTONE_ANCHORS[1:]):
        if d0 <= day <= d1:
            span = (d1 - d0).days
            frac = (day - d0).days / span if span else 0
            return round(v0 + (v1 - v0) * frac, 1)
    return MILESTONE_ANCHORS[-1][1]


def northstar_status(value: float, milestone: float, prior: float | None) -> str:
    """Red if below milestone; else green if up on prior period; else orange."""
    if value < milestone:
        return RED
    if prior is not None and prior > 0 and value > prior * (1 + FLAT_BAND):
        return GREEN
    return ORANGE


def trend_status(value: float, prior: float | None, higher_is_better: bool = True) -> str:
    """Channel-tile status with no milestone: up=green, flat=orange, down=red."""
    if prior is None or prior == 0:
        return ORANGE
    change = (value - prior) / prior
    if not higher_is_better:
        change = -change
    if change > FLAT_BAND:
        return GREEN
    if change < -FLAT_BAND:
        return RED
    return ORANGE


@dataclass
class GoalBanner:
    week_start: str
    new_patients: float
    milestone: float
    goal: int
    gap_to_goal: float
    gap_to_milestone: float
    percent_to_goal: float
    status: str

    @classmethod
    def build(cls, week_start: date, new_patients: float, prior: float | None) -> "GoalBanner":
        milestone = milestone_for(week_start)
        return cls(
            week_start=week_start.isoformat(),
            new_patients=round(new_patients, 1),
            milestone=milestone,
            goal=GOAL,
            gap_to_goal=round(GOAL - new_patients, 1),
            gap_to_milestone=round(new_patients - milestone, 1),
            percent_to_goal=round(new_patients / GOAL * 100, 1),
            status=northstar_status(new_patients, milestone, prior),
        )
