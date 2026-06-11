"""Public, no-auth data endpoints consumed by the React dashboard.

Two routes, returning exactly the JSON shapes the frontend store expects:
  GET /api/new-patients?weeks=12  -> [{date, location:"D2"|"D7", count}]
  GET /api/ad-rows?weeks=52       -> [{date, channel, campaign, spend,
                                       impressions, clicks, conversions}]

Both reuse the verified low-level clients in app/adapters/* (the single source
of truth for each platform's auth + rules). Results are cached in-process with a
TTL so the slow Cliniko crawl (~45s) only runs once per window per cache cycle,
not on every page load. These endpoints are intentionally UNauthenticated — the
dashboard is shared by link, with no login (per product decision).
"""
from __future__ import annotations

import logging
import os
import time
from datetime import date, timedelta

from fastapi import APIRouter

router = APIRouter()
log = logging.getLogger("spi.live")

_TTL_SECONDS = 30 * 60
_cache: dict[tuple, tuple[float, list]] = {}


def _cached(key: tuple, builder) -> list:
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < _TTL_SECONDS:
        return hit[1]
    value = builder()
    _cache[key] = (now, value)
    return value


# --- New patients (Cliniko) -------------------------------------------------

def _new_patients(weeks: int) -> list:
    from ..adapters.cliniko_client import new_patients_by_week

    today = date.today()
    this_monday = today - timedelta(days=today.weekday())
    window_start = this_monday - timedelta(weeks=weeks - 1)
    buckets = new_patients_by_week(window_start)  # {monday_iso: {"d2", "d7"}}

    rows: list = []
    for wk in sorted(buckets):
        b = buckets[wk]
        rows.append({"date": wk, "location": "D2", "count": int(b.get("d2", 0))})
        rows.append({"date": wk, "location": "D7", "count": int(b.get("d7", 0))})
    return rows


@router.get("/new-patients")
def new_patients(weeks: int = 12, refresh: int = 0):
    key = ("new-patients", weeks)
    if refresh:
        _cache.pop(key, None)
    return _cached(key, lambda: _new_patients(weeks))


# --- Ad performance (Google + Meta + YouTube) -------------------------------

def _flatten(channel: str, data: dict, *, clicks_key: str, conv_key: str) -> list:
    rows: list = []
    for info in data.values():
        name = info.get("name", "")
        for week, wk in info.get("weeks", {}).items():
            rows.append({
                "date": week,
                "channel": channel,
                "campaign": name,
                "spend": round(float(wk.get("spend", 0) or 0), 2),
                "impressions": int(wk.get("impressions", 0) or 0),
                "clicks": int(wk.get(clicks_key, 0) or 0),
                "conversions": round(float(wk.get(conv_key, 0) or 0), 1),
            })
    return rows


def _ad_rows(weeks: int) -> list:
    today = date.today()
    this_monday = today - timedelta(days=today.weekday())
    start = this_monday - timedelta(weeks=weeks - 1)
    end = this_monday + timedelta(days=6)

    rows: list = []

    # Google Ads search + YouTube video share one account/credential set.
    if os.environ.get("GOOGLE_ADS_REFRESH_TOKEN"):
        from ..adapters import google_ads_client as gc
        try:
            rows += _flatten("google", gc.weekly_campaign_metrics(start, end),
                             clicks_key="clicks", conv_key="conversions")
        except Exception as exc:  # noqa: BLE001 — one channel must not sink the rest
            log.warning("google_ads fetch failed: %s", exc)
        try:
            rows += _flatten("youtube", gc.weekly_video_campaign_metrics(start, end),
                             clicks_key="views", conv_key="conversions")
        except Exception as exc:  # noqa: BLE001
            log.warning("youtube fetch failed: %s", exc)

    # Meta (Facebook + Instagram).
    if os.environ.get("META_SYSTEM_USER_TOKEN"):
        from ..adapters import meta_client as mc
        try:
            rows += _flatten("meta", mc.weekly_campaign_metrics(start, end),
                             clicks_key="clicks", conv_key="leads")
        except Exception as exc:  # noqa: BLE001
            log.warning("meta fetch failed: %s", exc)

    rows.sort(key=lambda r: (r["date"], r["channel"], r["campaign"]))
    return rows


@router.get("/ad-rows")
def ad_rows(weeks: int = 52, refresh: int = 0):
    key = ("ad-rows", weeks)
    if refresh:
        _cache.pop(key, None)
    return _cached(key, lambda: _ad_rows(weeks))
