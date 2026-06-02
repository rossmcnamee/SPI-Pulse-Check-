"""Adapter contract + a shared mock implementation.

Each source is its own module (cliniko.py, google_ads.py, ...). They subclass
``MockSourceAdapter`` for now; wiring a source live means overriding
``get_historical`` / ``get_current_week`` in that one file with real API calls
that map raw responses into ``EntitySnapshot`` — nothing else in the app changes.
"""
from __future__ import annotations

from datetime import date
from typing import Protocol

from .. import mockdata
from ..schemas import EntitySnapshot
from ..timeutil import week_mondays


class Adapter(Protocol):
    source: str
    channel: str

    def get_historical(self, now: date, weeks: int) -> list[EntitySnapshot]: ...
    def get_current_week(self, now: date) -> list[EntitySnapshot]: ...


class MockSourceAdapter:
    source: str = ""
    channel: str = ""

    def _snapshots(self, now: date, weeks: int) -> list[EntitySnapshot]:
        mondays = week_mondays(now, weeks)
        entity_map = mockdata.build(self.source, len(mondays))
        out: list[EntitySnapshot] = []
        for entity_id, info in entity_map.items():
            for i, monday in enumerate(mondays):
                metrics = {k: v[i] for k, v in info["weeks"].items()}
                out.append(EntitySnapshot(
                    source=self.source,
                    channel=self.channel,
                    entity_id=entity_id,
                    entity_name=info["name"],
                    week_start=monday.isoformat(),
                    metrics=metrics,
                    location=info.get("location"),
                ))
        return out

    def get_historical(self, now: date, weeks: int) -> list[EntitySnapshot]:
        return self._snapshots(now, weeks)

    def get_current_week(self, now: date) -> list[EntitySnapshot]:
        # Take the latest week from the full series so the live headline matches
        # the last point of the stored 26-week trend.
        from ..timeutil import WEEKS_OF_HISTORY
        snaps = self._snapshots(now, WEEKS_OF_HISTORY)
        current = max(s.week_start for s in snaps)
        return [s for s in snaps if s.week_start == current]
