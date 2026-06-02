"""One-off 26-week backfill: pulls each source's history and stores weekly
snapshots so every trend graph is real from day one. Safe to re-run (idempotent).

Run:  python -m app.jobs.backfill
"""
from __future__ import annotations

from ..adapters import registry
from ..config import get_settings
from ..db import init_db
from ..store import upsert_snapshots
from ..timeutil import WEEKS_OF_HISTORY


def run(weeks: int = WEEKS_OF_HISTORY) -> dict[str, int]:
    settings = get_settings()
    init_db()
    now = settings.app_now
    results: dict[str, int] = {}
    for channel in registry.all_channels():
        adapter = registry.get_adapter(channel)
        snaps = adapter.get_historical(now, weeks)
        results[channel] = upsert_snapshots(snaps)
    return results


if __name__ == "__main__":
    summary = run()
    total = sum(summary.values())
    print(f"Backfill complete: {total} snapshots across {len(summary)} channels")
    for ch, count in summary.items():
        print(f"  {ch:12s} {count}")
