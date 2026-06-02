"""YouTube Ads adapter (video campaigns run through the Google Ads account).

Live when YOUTUBE_LIVE=true: same Google Ads API client/credentials as
google_ads.py, filtered to advertising_channel_type = VIDEO, with video metrics
(views, view rate, cost per view). Otherwise falls back to the mock generator so
the UI still renders. Credentials are read from the environment, never the browser.
"""
from __future__ import annotations

from datetime import date, timedelta

from ..config import get_settings
from ..schemas import EntitySnapshot
from ..timeutil import WEEKS_OF_HISTORY, monday_of, week_mondays
from . import google_ads_client as gac
from .base import MockSourceAdapter


class YouTubeAdapter(MockSourceAdapter):
    source = "youtube"
    channel = "youtube"

    def get_historical(self, now: date, weeks: int = WEEKS_OF_HISTORY) -> list[EntitySnapshot]:
        if get_settings().use_mock["youtube"]:
            return super().get_historical(now, weeks)
        mondays = week_mondays(now, weeks)
        data = gac.weekly_video_campaign_metrics(mondays[0], mondays[-1] + timedelta(days=6))
        return self._build(mondays, data)

    def get_current_week(self, now: date) -> list[EntitySnapshot]:
        if get_settings().use_mock["youtube"]:
            return super().get_current_week(now)
        current = monday_of(now)
        data = gac.weekly_video_campaign_metrics(current, current + timedelta(days=6))
        return self._build([current], data)

    def _build(self, mondays, data: dict) -> list[EntitySnapshot]:
        out: list[EntitySnapshot] = []
        for cid, info in data.items():
            for monday in mondays:
                key = monday.isoformat()
                wk = info["weeks"].get(key)
                if not wk:
                    continue
                metrics = {
                    "spend": round(wk["spend"], 2),
                    "impressions": float(wk["impressions"]),
                    "views": float(wk["views"]),
                    "view_rate": round(wk["view_rate"], 2),
                    "cost_per_view": round(wk["cost_per_view"], 3),
                    "conversions": round(wk["conversions"], 1),
                }
                out.append(EntitySnapshot(
                    source=self.source,
                    channel=self.channel,
                    entity_id=cid,
                    entity_name=info["name"],
                    week_start=key,
                    metrics=metrics,
                    location=None,
                ))
        return out
