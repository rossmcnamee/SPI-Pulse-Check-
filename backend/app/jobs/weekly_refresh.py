"""Weekly scheduled job (Render Cron entrypoint): append the latest completed
week from each source. Idempotent — re-running the same week updates in place
rather than duplicating.

Run:  python -m app.jobs.weekly_refresh
"""
from __future__ import annotations

from ..adapters import registry
from ..config import get_settings
from ..db import init_db
from ..store import upsert_snapshots


def run() -> dict[str, int]:
    settings = get_settings()
    init_db()
    now = settings.app_now
    results: dict[str, int] = {}
    for channel in registry.all_channels():
        adapter = registry.get_adapter(channel)
        snaps = adapter.get_current_week(now)
        results[channel] = upsert_snapshots(snaps)
    return results


if __name__ == "__main__":
    summary = run()
    print(f"Weekly refresh complete: {sum(summary.values())} snapshots updated")
    for ch, count in summary.items():
        print(f"  {ch:12s} {count}")
