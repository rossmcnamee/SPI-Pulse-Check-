"""Low-level Meta (Facebook/Instagram) Marketing API access (REST + stdlib only).

Reads campaign-level Insights for one ad account, bucketed into Monday-aligned
weeks via time_increment=7 (the `since` date is always a Monday, so each bucket
is Mon–Sun and weekly `reach` stays correctly de-duplicated).

Credentials come from the environment and are never logged or sent to the
browser. Only aggregate campaign metrics are read — no audience PII.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

API_VERSION = os.getenv("META_API_VERSION", "v21.0")
_API_ROOT = "https://graph.facebook.com"

# "Both combined": Meta's standard `lead` action is the umbrella total that
# already sums on-Meta instant-form leads (onsite_conversion.lead_grouped) and
# website pixel leads (offsite_conversion.fb_pixel_lead) — it matches the "Leads"
# column in Ads Manager. Summing the sub-types as well would double-count.
_LEAD_ACTION_TYPES = {"lead"}


def _account_id() -> str:
    """Normalise to the `act_<digits>` form the Graph API expects."""
    raw = (os.environ["META_AD_ACCOUNT_ID"] or "").strip()
    digits = "".join(ch for ch in raw if ch.isdigit())
    return "act_" + digits


def _appsecret_proof(token: str) -> str | None:
    secret = os.getenv("META_APP_SECRET", "").strip()
    if not secret:
        return None
    return hmac.new(secret.encode(), token.encode(), hashlib.sha256).hexdigest()


def _get(path: str, params: dict) -> dict:
    url = f"{_API_ROOT}/{API_VERSION}/{path}?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        # Strip the access_token if it ever appears in an echoed URL.
        raise RuntimeError(f"Meta API {exc.code}: {detail}") from None


def _insights_rows(since: date, until: date) -> list[dict]:
    """All weekly campaign-insight rows between since (a Monday) and until."""
    token = os.environ["META_SYSTEM_USER_TOKEN"]
    params = {
        "access_token": token,
        "level": "campaign",
        "fields": "campaign_id,campaign_name,spend,reach,impressions,clicks,actions",
        "time_increment": 7,
        "time_range": json.dumps({"since": since.isoformat(), "until": until.isoformat()}),
        "limit": 200,
    }
    proof = _appsecret_proof(token)
    if proof:
        params["appsecret_proof"] = proof

    rows: list[dict] = []
    payload = _get(f"{_account_id()}/insights", params)
    while True:
        rows.extend(payload.get("data", []))
        nxt = payload.get("paging", {}).get("next")
        if not nxt:
            break
        # Follow the absolute pagination URL directly.
        req = urllib.request.Request(nxt, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                payload = json.load(resp)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")
            raise RuntimeError(f"Meta API {exc.code}: {detail}") from None
    return rows


def _leads(actions: list[dict]) -> float:
    total = 0.0
    for a in actions or []:
        if a.get("action_type") in _LEAD_ACTION_TYPES:
            total += float(a.get("value", 0) or 0)
    return total


def weekly_campaign_metrics(since: date, until: date) -> dict:
    """Per-campaign weekly metrics. `since` must be a Monday.

    Returns { campaign_id: {"name": str, "weeks": { monday_iso: {
        spend, reach, impressions, clicks, leads } } } }.
    """
    out: dict = {}
    for row in _insights_rows(since, until):
        cid = str(row.get("campaign_id"))
        week = row.get("date_start")  # ISO date == the Monday of the bucket
        if not cid or not week:
            continue
        bucket = out.setdefault(cid, {"name": row.get("campaign_name", cid), "weeks": {}})
        bucket["weeks"][week] = {
            "spend": float(row.get("spend", 0) or 0),
            "reach": int(float(row.get("reach", 0) or 0)),
            "impressions": int(float(row.get("impressions", 0) or 0)),
            "clicks": int(float(row.get("clicks", 0) or 0)),
            "leads": _leads(row.get("actions")),
        }
    return out
