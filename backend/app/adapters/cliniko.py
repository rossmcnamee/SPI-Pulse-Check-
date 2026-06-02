"""Cliniko adapter — the North Star source (first live integration).

New patient = a patient new to Cliniko (no prior record) whose FIRST individual
appointment is at Dublin 2 or Dublin 7, EXCLUDING the HSE appointment types,
counted in the ISO week the booking was CREATED (point of booking). Returned as a
combined headline plus the Dublin 2 / Dublin 7 split.

Live when CLINIKO_LIVE=true and CLINIKO_API_KEY is set (the shard is derived from
the key). Otherwise falls back to the mock generator so the UI still renders.
Credentials are read from the environment and never logged or sent to the browser.
"""
from __future__ import annotations

from datetime import date

from ..config import get_settings
from ..schemas import EntitySnapshot
from ..timeutil import WEEKS_OF_HISTORY, monday_of, week_mondays
from . import cliniko_client as cc
from .base import MockSourceAdapter

LOC_D2 = "Dublin 2"
LOC_D7 = "Dublin 7"


class ClinikoAdapter(MockSourceAdapter):
    source = "cliniko"
    channel = "cliniko"

    def get_historical(self, now: date, weeks: int = WEEKS_OF_HISTORY) -> list[EntitySnapshot]:
        if get_settings().use_mock["cliniko"]:
            return super().get_historical(now, weeks)
        mondays = week_mondays(now, weeks)
        counts = cc.new_patients_by_week(mondays[0])
        return self._build(mondays, counts)

    def get_current_week(self, now: date) -> list[EntitySnapshot]:
        if get_settings().use_mock["cliniko"]:
            return super().get_current_week(now)
        current = monday_of(now)
        counts = cc.new_patients_by_week(current)
        return self._build([current], counts)

    def _build(self, mondays, counts: dict) -> list[EntitySnapshot]:
        out: list[EntitySnapshot] = []
        for monday in mondays:
            key = monday.isoformat()
            week = counts.get(key, {})
            d2 = int(week.get("d2", 0))
            d7 = int(week.get("d7", 0))
            rows = [
                ("combined", "SPI – Both Locations", None, d2 + d7),
                ("dublin-2", "Dublin 2", LOC_D2, d2),
                ("dublin-7", "Dublin 7", LOC_D7, d7),
            ]
            for entity_id, name, location, value in rows:
                out.append(EntitySnapshot(
                    source=self.source,
                    channel=self.channel,
                    entity_id=entity_id,
                    entity_name=name,
                    week_start=key,
                    metrics={"new_patients": float(value)},
                    location=location,
                ))
        return out
