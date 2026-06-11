#!/usr/bin/env python3
"""Print live ad-performance rows as JSON in the dashboard's AdRow shape.

Output: [{"date","channel","campaign","spend","impressions","clicks","conversions"}, ...]
One row per campaign per ISO week (dated the Monday), for the last N weeks, across
three channels:

  • google  — Google Ads search/other campaigns (weekly_campaign_metrics)
  • youtube — Google Ads VIDEO campaigns, same account (weekly_video_campaign_metrics)
  • meta    — Meta (Facebook/Instagram) campaigns (weekly_campaign_metrics)

Reuses the proven low-level clients in app/adapters/* — the single source of truth
for each platform's auth + field mapping, so the local dev API and any future
deploy compute identical numbers.

Field mapping into the shared AdRow shape:
  • google  : conversions = Google "conversions"
  • meta    : conversions = "leads" (lead-form + pixel), clicks = link/all clicks
  • youtube : clicks = video views, conversions = Google "conversions"

Each channel is fetched independently; if one platform errors (bad creds, API
hiccup) the others still return. Errors go to stderr, never stdout, so the JSON
on stdout is always valid.

Usage:  python3 backend/scripts/ad_rows_json.py [weeks]
Reads Google Ads + Meta credentials from backend/.env.
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


def _flatten(channel: str, data: dict, *, clicks_key: str, conv_key: str) -> list[dict]:
    """Turn { campaign_id: {name, weeks:{monday:{...}}} } into flat AdRow dicts."""
    rows: list[dict] = []
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


def main() -> int:
    _load_env()
    weeks = int(sys.argv[1]) if len(sys.argv) > 1 else 12

    today = date.today()
    this_monday = today - timedelta(days=today.weekday())
    start = this_monday - timedelta(weeks=weeks - 1)
    end = this_monday + timedelta(days=6)  # through the end of the current week

    rows: list[dict] = []

    # Google Ads (search/other) + YouTube (video) — same account/credentials.
    if os.environ.get("GOOGLE_ADS_REFRESH_TOKEN"):
        try:
            from app.adapters import google_ads_client as gc
            rows += _flatten("google", gc.weekly_campaign_metrics(start, end),
                             clicks_key="clicks", conv_key="conversions")
        except Exception as exc:  # noqa: BLE001 — one bad channel shouldn't kill the rest
            print(f"google_ads: {exc}", file=sys.stderr)
        try:
            from app.adapters import google_ads_client as gc
            rows += _flatten("youtube", gc.weekly_video_campaign_metrics(start, end),
                             clicks_key="views", conv_key="conversions")
        except Exception as exc:  # noqa: BLE001
            print(f"youtube: {exc}", file=sys.stderr)
    else:
        print("google_ads: GOOGLE_ADS_REFRESH_TOKEN not set — skipping", file=sys.stderr)

    # Meta (Facebook + Instagram). `since` must be a Monday — `start` is.
    if os.environ.get("META_SYSTEM_USER_TOKEN"):
        try:
            from app.adapters import meta_client as mc
            rows += _flatten("meta", mc.weekly_campaign_metrics(start, end),
                             clicks_key="clicks", conv_key="leads")
        except Exception as exc:  # noqa: BLE001
            print(f"meta: {exc}", file=sys.stderr)
    else:
        print("meta: META_SYSTEM_USER_TOKEN not set — skipping", file=sys.stderr)

    rows.sort(key=lambda r: (r["date"], r["channel"], r["campaign"]))
    print(json.dumps(rows))
    return 0


if __name__ == "__main__":
    sys.exit(main())
