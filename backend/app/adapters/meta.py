"""Meta (Facebook + Instagram) Ads adapter.

Live when META_LIVE=true and the system-user token + ad account ID are set;
otherwise falls back to the mock generator so the UI still renders. All
credentials are read from the environment and never sent to the browser.

"Leads" combines on-Meta lead-form submissions and website pixel leads.
"""
from __future__ import annotations

from datetime import date, timedelta

from ..config import get_settings
from ..schemas import EntitySnapshot
from ..timeutil import WEEKS_OF_HISTORY, monday_of, week_mondays
from . import meta_client as mc
from .base import MockSourceAdapter


class MetaAdapter(MockSourceAdapter):
    source = "meta"
    channel = "meta"

    def get_historical(self, now: date, weeks: int = WEEKS_OF_HISTORY) -> list[EntitySnapshot]:
        if get_settings().use_mock["meta"]:
            return super().get_historical(now, weeks)
        mondays = week_mondays(now, weeks)
        data = mc.weekly_campaign_metrics(mondays[0], mondays[-1] + timedelta(days=6))
        return self._build(mondays, data)

    def get_current_week(self, now: date) -> list[EntitySnapshot]:
        if get_settings().use_mock["meta"]:
            return super().get_current_week(now)
        current = monday_of(now)
        data = mc.weekly_campaign_metrics(current, current + timedelta(days=6))
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
                leads = wk["leads"]
                metrics = {
                    "spend": round(spend, 2),
                    "reach": float(wk["reach"]),
                    "impressions": float(wk["impressions"]),
                    "clicks": float(wk["clicks"]),
                    "leads": round(leads, 1),
                    "cost_per_lead": round(spend / leads, 2) if leads else 0.0,
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
