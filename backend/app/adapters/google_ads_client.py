"""Low-level Google Ads API access (REST + stdlib only — no third-party deps).

Auth is OAuth2: the long-lived refresh token mints a short-lived access token,
which is sent as a Bearer credential alongside the developer token. Reporting is
done with GAQL over the REST `searchStream` endpoint, segmented by ISO week.

All credentials are read from the environment and never logged. Only aggregate
campaign metrics are read — no account-holder or customer PII.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

API_VERSION = os.getenv("GOOGLE_ADS_API_VERSION", "v21")
_TOKEN_URL = "https://oauth2.googleapis.com/token"
_API_ROOT = "https://googleads.googleapis.com"

# Video campaigns belong to the YouTube tab (same account); everything else is
# "Google Ads" for our purposes.
_EXCLUDE_CHANNEL_TYPES = {"VIDEO"}


def _digits(value: str) -> str:
    return "".join(ch for ch in (value or "") if ch.isdigit())


def _access_token() -> str:
    """Exchange the stored refresh token for a fresh access token."""
    body = urllib.parse.urlencode({
        "client_id": os.environ["GOOGLE_ADS_CLIENT_ID"],
        "client_secret": os.environ["GOOGLE_ADS_CLIENT_SECRET"],
        "refresh_token": os.environ["GOOGLE_ADS_REFRESH_TOKEN"],
        "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request(_TOKEN_URL, data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)["access_token"]


def _headers() -> dict:
    headers = {
        "Authorization": "Bearer " + _access_token(),
        "developer-token": os.environ["GOOGLE_ADS_DEVELOPER_TOKEN"],
        "Content-Type": "application/json",
    }
    login = _digits(os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", ""))
    if login:
        headers["login-customer-id"] = login
    return headers


def _search_stream(query: str) -> list:
    """Run a GAQL query and return the flattened list of result rows."""
    customer = _digits(os.environ["GOOGLE_ADS_CUSTOMER_ID"])
    url = f"{_API_ROOT}/{API_VERSION}/customers/{customer}/googleAds:searchStream"
    data = json.dumps({"query": query}).encode()
    req = urllib.request.Request(url, data=data, headers=_headers(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            payload = json.load(resp)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        raise RuntimeError(f"Google Ads API {exc.code}: {detail}") from None
    rows: list = []
    for batch in payload:
        rows.extend(batch.get("results", []))
    return rows


def weekly_campaign_metrics(start: date, end: date) -> dict:
    """Per-campaign weekly metrics between start and end (inclusive).

    Returns { campaign_id: {"name": str, "weeks": { monday_iso: {
        spend, impressions, clicks, conversions } } } }.
    Video campaigns are excluded (they feed the YouTube tab).
    """
    query = (
        "SELECT campaign.id, campaign.name, campaign.advertising_channel_type, "
        "segments.week, metrics.cost_micros, metrics.impressions, "
        "metrics.clicks, metrics.conversions "
        "FROM campaign "
        f"WHERE segments.date BETWEEN '{start.isoformat()}' AND '{end.isoformat()}' "
        "AND campaign.advertising_channel_type != 'VIDEO'"
    )
    out: dict = {}
    for row in _search_stream(query):
        camp = row.get("campaign", {})
        if camp.get("advertisingChannelType") in _EXCLUDE_CHANNEL_TYPES:
            continue
        cid = str(camp.get("id"))
        week = row.get("segments", {}).get("week")
        if not week:
            continue
        metrics = row.get("metrics", {})
        bucket = out.setdefault(cid, {"name": camp.get("name", cid), "weeks": {}})
        bucket["weeks"][week] = {
            "spend": int(metrics.get("costMicros", 0)) / 1_000_000,
            "impressions": int(metrics.get("impressions", 0)),
            "clicks": int(metrics.get("clicks", 0)),
            "conversions": float(metrics.get("conversions", 0.0)),
        }
    return out


def weekly_video_campaign_metrics(start: date, end: date) -> dict:
    """Per-campaign weekly metrics for VIDEO (YouTube) campaigns between start and
    end (inclusive). Same Google Ads account/credentials as the search campaigns.

    Returns { campaign_id: {"name": str, "weeks": { monday_iso: {
        spend, impressions, views, view_rate, cost_per_view, conversions } } } }.
    view_rate is a percentage (0-100); cost_per_view is in account currency.
    """
    query = (
        "SELECT campaign.id, campaign.name, campaign.advertising_channel_type, "
        "segments.week, metrics.cost_micros, metrics.impressions, "
        "metrics.video_views, metrics.video_view_rate, metrics.average_cpv, "
        "metrics.conversions "
        "FROM campaign "
        f"WHERE segments.date BETWEEN '{start.isoformat()}' AND '{end.isoformat()}' "
        "AND campaign.advertising_channel_type = 'VIDEO'"
    )
    out: dict = {}
    for row in _search_stream(query):
        camp = row.get("campaign", {})
        if camp.get("advertisingChannelType") != "VIDEO":
            continue
        cid = str(camp.get("id"))
        week = row.get("segments", {}).get("week")
        if not week:
            continue
        metrics = row.get("metrics", {})
        # video_view_rate is a fraction (0-1); average_cpv is micros of currency.
        view_rate = float(metrics.get("videoViewRate", 0.0)) * 100.0
        bucket = out.setdefault(cid, {"name": camp.get("name", cid), "weeks": {}})
        bucket["weeks"][week] = {
            "spend": int(metrics.get("costMicros", 0)) / 1_000_000,
            "impressions": int(metrics.get("impressions", 0)),
            "views": int(metrics.get("videoViews", 0)),
            "view_rate": view_rate,
            "cost_per_view": int(metrics.get("averageCpv", 0)) / 1_000_000,
            "conversions": float(metrics.get("conversions", 0.0)),
        }
    return out
