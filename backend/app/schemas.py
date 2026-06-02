"""Normalised shapes every adapter returns and every route serves.

The frontend never branches on data source: each source maps its raw API into
these shapes, and the canonical metric vocabulary below is the only contract.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

# Canonical metric keys (a source only fills the ones it has):
#   spend, impressions, clicks, conversions, leads, bookings, reach,
#   cost_per_conversion, cost_per_lead, conversion_rate, cost_per_view,
#   views, view_rate, new_patients, sessions, users,
#   profile_views, searches, calls, direction_requests, website_clicks,
#   new_reviews, reviews_total, rating_avg


class WeekPoint(BaseModel):
    week_start: str
    metrics: dict[str, float]


class EntitySnapshot(BaseModel):
    """One campaign / location / property for one week."""
    source: str
    channel: str
    entity_id: str
    entity_name: str
    week_start: str
    metrics: dict[str, float]
    location: Optional[str] = None


class EntitySummary(BaseModel):
    """A campaign/property in a channel listing, with its week-over-week trend."""
    entity_id: str
    entity_name: str
    location: Optional[str] = None
    direction: str  # "up" | "down" | "flat" — last completed week vs the one before
    change_pct: Optional[float] = None
    metrics: dict[str, float]  # values from the entity's last *active* week
    weeks_stale: int = 0  # weeks since last activity (0 = active this week)


class TrendSeries(BaseModel):
    """A named weekly series for charting (e.g. spend, conversions)."""
    key: str
    label: str
    points: list[float]


class ChannelView(BaseModel):
    channel: str
    label: str
    description: str
    direction: str  # "up" | "down" | "flat" — channel primary metric, week over week
    change_pct: Optional[float] = None
    primary_metric: str
    headline: dict[str, float]
    weeks: list[str]
    trends: list[TrendSeries]
    entities: list[EntitySummary]
    extras: dict = {}


class EntityDetail(BaseModel):
    channel: str
    entity_id: str
    entity_name: str
    location: Optional[str] = None
    direction: str  # "up" | "down" | "flat" — primary metric, week over week
    change_pct: Optional[float] = None
    current: dict[str, float]
    prior: dict[str, float]
    weeks: list[str]
    trends: list[TrendSeries]


class ChannelTile(BaseModel):
    key: str
    label: str
    status: str
    headline_label: str
    headline_value: float
    headline_unit: str
    prior_value: Optional[float] = None


class GoalBannerOut(BaseModel):
    week_start: str
    new_patients: float
    milestone: float
    goal: int
    gap_to_goal: float
    gap_to_milestone: float
    percent_to_goal: float
    status: str


class OverviewView(BaseModel):
    goal: GoalBannerOut
    weeks: list[str]
    northstar_trend: list[float]
    milestone_trend: list[float]
    tiles: list[ChannelTile]
