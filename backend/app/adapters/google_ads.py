"""Google Ads adapter (search/display/etc campaigns). YouTube video campaigns
come from the same account via the YouTube adapter and are excluded here.

Live when GOOGLE_ADS_LIVE=true and the OAuth + developer-token credentials are
set; otherwise falls back to the mock generator so the UI still renders. All
credentials are read from the environment and never sent to the browser.
"""
from __future__ import annotations

from datetime import date, timedelta

from ..config import get_settings
from ..schemas import EntitySnapshot
from ..timeutil import WEEKS_OF_HISTORY, monday_of, week_mondays
from . import google_ads_client as gac
from .base import MockSourceAdapter


class GoogleAdsAdapter(MockSourceAdapter):
    source = "google_ads"
    channel = "google_ads"

    def get_historical(self, now: date, weeks: int = WEEKS_OF_HISTORY) -> list[EntitySnapshot]:
        if get_settings().use_mock["google_ads"]:
            return super().get_historical(now, weeks)
        mondays = week_mondays(now, weeks)
        data = gac.weekly_campaign_metrics(mondays[0], mondays[-1] + timedelta(days=6))
        return self._build(mondays, data)

    def get_current_week(self, now: date) -> list[EntitySnapshot]:
        if get_settings().use_mock["google_ads"]:
            return super().get_current_week(now)
        current = monday_of(now)
        data = gac.weekly_campaign_metrics(current, current + timedelta(days=6))
        return self._build([current], data)

    def _build(self, mondays, data: dict) -> list[EntitySnapshot]:
        out: list[EntitySnapshot] = []
        for cid, info in data.items():
            for monday in mondays:
                key = monday.isoformat()
                wk = info["weeks"].get(key)
                if not wk:
                    continue
                spend = wk["spend"]
                clicks = wk["clicks"]
                conv = wk["conversions"]
                metrics = {
                    "spend": round(spend, 2),
                    "impressions": float(wk["impressions"]),
                    "clicks": float(clicks),
                    "conversions": round(conv, 1),
                    "cost_per_conversion": round(spend / conv, 2) if conv else 0.0,
                    "conversion_rate": round(conv / clicks * 100, 2) if clicks else 0.0,
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
