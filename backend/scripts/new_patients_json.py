#!/usr/bin/env python3
"""Print live Cliniko new-patient rows as JSON in the dashboard's shape.

Output: [{"date": "YYYY-MM-DD", "location": "D2"|"D7", "count": int}, ...]
One row per location per ISO week (dated the Monday), for the last N weeks.

Reuses the proven Cliniko logic in app/adapters/cliniko_client.py — this is the
single source of truth for the new-patient rule, so the local dev API and any
future deploy compute identical numbers.

Usage:  python3 backend/scripts/new_patients_json.py [weeks]
Reads CLINIKO_API_KEY (+ optional CLINIKO_USER_AGENT) from backend/.env.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
sys.path.insert(0, BACKEND)


def _load_env() -> None:
    path = os.path.join(BACKEND, ".env")
    if not os.path.exists(path):
        return
    for line in open(path):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def main() -> int:
    _load_env()
    weeks = int(sys.argv[1]) if len(sys.argv) > 1 else 12

    if not os.environ.get("CLINIKO_API_KEY"):
        print(json.dumps({"error": "CLINIKO_API_KEY not set in backend/.env"}))
        return 1

    from app.adapters.cliniko_client import new_patients_by_week

    today = date.today()
    this_monday = today - timedelta(days=today.weekday())
    window_start = this_monday - timedelta(weeks=weeks - 1)

    buckets = new_patients_by_week(window_start)  # {monday_iso: {"d2": int, "d7": int}}

    rows = []
    for wk in sorted(buckets):
        b = buckets[wk]
        rows.append({"date": wk, "location": "D2", "count": int(b.get("d2", 0))})
        rows.append({"date": wk, "location": "D7", "count": int(b.get("d7", 0))})

    print(json.dumps(rows))
    return 0


if __name__ == "__main__":
    sys.exit(main())
