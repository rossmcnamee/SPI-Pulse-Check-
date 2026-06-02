"""Assembles API responses from stored snapshots (trends) + live current week.

Trends read from the DB for speed/consistency; the latest week is overlaid with
a live adapter pull (short-cached) so headline numbers feel live. Status compares
the current week against a trailing 4-week baseline so colours track the trend
rather than single-week noise.
"""
from __future__ import annotations

import time
from datetime import date
from typing import Optional

from . import store
from .adapters import registry
from .channels_config import CHANNELS, METRIC_META
from .milestones import GoalBanner, milestone_for, northstar_status, trend_status
from .schemas import (
    ChannelTile, ChannelView, EntityDetail, EntitySummary, GoalBannerOut,
    OverviewView, TrendSeries,
)
from .timeutil import WEEKS_OF_HISTORY, week_mondays

_LIVE_TTL = 300  # seconds
_BASELINE_WINDOW = 4
_live_cache: dict[str, tuple[float, dict]] = {}


def _live_current(channel: str, now: date) -> dict:
    hit = _live_cache.get(channel)
    if hit and time.time() - hit[0] < _LIVE_TTL:
        return hit[1]
    snaps = registry.get_adapter(channel).get_current_week(now)
    data = {(s.entity_id, s.week_start): s.metrics for s in snaps}
    _live_cache[channel] = (time.time(), data)
    return data


def _load(channel: str, now: date):
    """(weeks, entities) where entities[id] = {name, location, series{metric:[...]}}.
    Series align to a fixed rolling 26-week axis ending at the current week, so a
    channel that stopped running (no recent snapshots) visibly trails off to zero
    rather than silently truncating the chart. The latest week is overlaid live."""
    snaps = store.get_channel_snapshots(channel)
    if not snaps:
        snaps = registry.get_adapter(channel).get_historical(now, WEEKS_OF_HISTORY)
    weeks = [m.isoformat() for m in week_mondays(now, WEEKS_OF_HISTORY)]
    latest = weeks[-1]
    live = _live_current(channel, now)

    by_entity: dict[str, dict] = {}
    for s in snaps:
        e = by_entity.setdefault(s.entity_id, {"name": s.entity_name, "location": s.location, "byweek": {}})
        e["byweek"][s.week_start] = dict(s.metrics)
    for (eid, wk), metrics in live.items():
        if eid in by_entity and wk == latest:
            by_entity[eid]["byweek"][wk] = dict(metrics)

    for e in by_entity.values():
        keys = set()
        for m in e["byweek"].values():
            keys.update(m.keys())
        e["series"] = {k: [e["byweek"].get(w, {}).get(k, 0.0) for w in weeks] for k in keys}
    return weeks, by_entity


def _aggregate(channel: str, entities: dict, n_weeks: int, metric: str) -> list[float]:
    """Channel-level series for a metric. Cliniko uses the combined entity only
    (it already equals D2 + D7); other channels sum across entities."""
    if channel == "cliniko":
        return entities.get("combined", {}).get("series", {}).get(metric, [0.0] * n_weeks)
    totals = [0.0] * n_weeks
    for e in entities.values():
        for i, v in enumerate(e["series"].get(metric, [])):
            totals[i] += v
    return [round(v, 2) for v in totals]


def _baseline(series: list[float], window: int = _BASELINE_WINDOW) -> Optional[float]:
    """Mean of the `window` weeks immediately before the current week."""
    if len(series) < 2:
        return None
    prior = series[-(window + 1):-1] if len(series) > window else series[:-1]
    return sum(prior) / len(prior) if prior else None


def _status(channel: str, weeks: list[str], series: list[float], higher_is_better: bool,
            has_milestone: bool) -> str:
    cur = series[-1] if series else 0.0
    base = _baseline(series)
    if has_milestone:
        return northstar_status(cur, milestone_for(date.fromisoformat(weeks[-1])), base)
    return trend_status(cur, base, higher_is_better)


_FLAT_BAND_PCT = 2.0  # within +/-2% week over week reads as "flat"


def _last_active_index(series_map: dict[str, list[float]], n: int) -> int:
    """Index of the most recent week with any non-zero metric for this entity.
    Lets a paused campaign keep showing its last real figures instead of the
    zeros that the fixed 26-week axis pads the tail with."""
    for i in range(n - 1, -1, -1):
        if any(vals[i] for vals in series_map.values() if i < len(vals)):
            return i
    return n - 1 if n else 0


def _direction(series: list[float]) -> tuple[str, Optional[float]]:
    """Trend over the two most recent COMPLETED weeks, ignoring the in-progress
    current week (the last point). Returns (direction, signed_pct_change)."""
    completed = series[:-1] if len(series) >= 2 else series
    if len(completed) < 2:
        return "flat", None
    cur, prev = completed[-1], completed[-2]
    if prev == 0:
        return ("up", None) if cur > 0 else ("flat", None)
    pct = round((cur - prev) / prev * 100, 1)
    if pct > _FLAT_BAND_PCT:
        return "up", pct
    if pct < -_FLAT_BAND_PCT:
        return "down", pct
    return "flat", pct


# ---- channel view ----------------------------------------------------------

def build_channel_view(channel: str, now: date) -> ChannelView:
    cfg = CHANNELS[channel]
    weeks, entities = _load(channel, now)
    n = len(weeks)
    primary = cfg["primary_metric"]

    trends = [TrendSeries(key=k, label=lbl, points=_aggregate(channel, entities, n, k))
              for k, lbl in cfg["trend_keys"]]
    primary_series = _aggregate(channel, entities, n, primary)
    direction, change_pct = _direction(primary_series)

    headline = {k: (_aggregate(channel, entities, n, k)[-1] if n else 0.0) for k, _ in cfg["trend_keys"]}
    headline[primary] = round(primary_series[-1], 2) if primary_series else 0.0

    summaries = []
    for eid, e in entities.items():
        eseries = e["series"].get(primary, [])
        edir, epct = _direction(eseries)
        idx = _last_active_index(e["series"], n)
        summaries.append(EntitySummary(
            entity_id=eid, entity_name=e["name"], location=e["location"],
            direction=edir, change_pct=epct,
            weeks_stale=(n - 1 - idx) if n else 0,
            metrics={k: round(v[idx], 2) for k, v in e["series"].items() if v and idx < len(v)},
        ))
    summaries.sort(key=lambda s: s.metrics.get(primary, 0), reverse=True)

    return ChannelView(
        channel=channel, label=cfg["label"], description=cfg["description"],
        direction=direction, change_pct=change_pct,
        primary_metric=primary, headline=headline,
        weeks=weeks, trends=trends, entities=summaries,
        extras=_channel_extras(channel, now),
    )


def _channel_extras(channel: str, now: date) -> dict:
    if channel == "funnel":
        from . import mockdata
        return {
            "injury_tags": mockdata.injury_tag_breakdown(now),
            "pipeline": mockdata.pipeline_snapshot(now),
        }
    return {}


# ---- entity detail ---------------------------------------------------------

def build_entity_detail(channel: str, entity_id: str, now: date) -> EntityDetail:
    cfg = CHANNELS[channel]
    weeks, entities = _load(channel, now)
    if entity_id not in entities:
        raise KeyError(entity_id)
    e = entities[entity_id]
    current = {k: round(v[-1], 2) for k, v in e["series"].items() if v}
    prior = {k: round(v[-2], 2) for k, v in e["series"].items() if len(v) > 1}
    trends = [TrendSeries(key=k, label=METRIC_META.get(k, {}).get("label", k),
                          points=[round(x, 2) for x in v]) for k, v in e["series"].items()]
    pseries = e["series"].get(cfg["primary_metric"], [])
    direction, change_pct = _direction(pseries)
    return EntityDetail(
        channel=channel, entity_id=entity_id, entity_name=e["name"], location=e["location"],
        direction=direction, change_pct=change_pct,
        current=current, prior=prior, weeks=weeks, trends=trends,
    )


# ---- overview --------------------------------------------------------------

def build_goal_banner(now: date) -> GoalBannerOut:
    weeks, entities = _load("cliniko", now)
    series = entities.get("combined", {}).get("series", {}).get("new_patients", [])
    cur = series[-1] if series else 0.0
    banner = GoalBanner.build(date.fromisoformat(weeks[-1]), cur, _baseline(series))
    return GoalBannerOut(**banner.__dict__)


def build_overview(now: date) -> OverviewView:
    weeks, entities = _load("cliniko", now)
    np_series = entities.get("combined", {}).get("series", {}).get("new_patients", [])
    milestone_trend = [milestone_for(date.fromisoformat(w)) for w in weeks]

    tiles = []
    for channel, cfg in CHANNELS.items():
        ch_weeks, ent = _load(channel, now)
        primary = cfg["primary_metric"]
        series = _aggregate(channel, ent, len(ch_weeks), primary)
        cur = series[-1] if series else 0.0
        base = _baseline(series)
        status = _status(channel, ch_weeks, series, cfg["higher_is_better"], cfg["has_milestone"])
        meta = METRIC_META.get(primary, {})
        tiles.append(ChannelTile(
            key=channel, label=cfg["label"], status=status,
            headline_label=meta.get("label", primary),
            headline_value=round(cur, 1), headline_unit=cfg["primary_unit"],
            prior_value=round(base, 1) if base is not None else None,
        ))

    banner = build_goal_banner(now)
    return OverviewView(
        goal=banner, weeks=weeks,
        northstar_trend=[round(v, 1) for v in np_series],
        milestone_trend=milestone_trend, tiles=tiles,
    )
