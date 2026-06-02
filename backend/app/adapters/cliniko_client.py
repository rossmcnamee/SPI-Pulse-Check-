"""Low-level Cliniko API access (stdlib only — no third-party deps).

Implements the North Star "new patient" rule:
  A patient new to Cliniko (no prior record) whose FIRST individual appointment
  is at Dublin 2 or Dublin 7, EXCLUDING HSE appointment types, counted in the
  ISO week the booking was created (point of booking).

The API key (and therefore the regional shard) is read from the environment and
is never logged. Auth is HTTP Basic with the key as username and empty password.
"""
from __future__ import annotations

import base64
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta

# The two public retail clinics — the only locations that count toward the goal.
D2_BUSINESS = "60813"
D7_BUSINESS = "970254877005448738"

# Appointment types to exclude entirely (public Health Service Executive bookings).
HSE_TYPE_IDS = {"1816905887386699294", "1866686745827870233"}


def _base_and_headers() -> tuple[str, dict]:
    key = os.environ["CLINIKO_API_KEY"]
    shard = key.rsplit("-", 1)[-1]
    auth = base64.b64encode((key + ":").encode()).decode()
    # Cliniko requires a User-Agent that identifies the app + a contact address.
    ua = os.getenv("CLINIKO_USER_AGENT", "SPI-Dashboard (ross@rfmdigital.co)")
    headers = {
        "Authorization": "Basic " + auth,
        "Accept": "application/json",
        "User-Agent": ua,
    }
    return f"https://api.{shard}.cliniko.com/v1", headers


def _get(url: str, headers: dict, _tries: int = 0):
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        if exc.code == 429 and _tries < 6:
            wait = int(exc.headers.get("Retry-After", "5"))
            time.sleep(max(1, wait))
            return _get(url, headers, _tries + 1)
        raise


def _paginate(path: str, collection: str):
    base, headers = _base_and_headers()
    url = base + path
    while url:
        data = _get(url, headers)
        for item in data.get(collection, []):
            yield item
        url = (data.get("links") or {}).get("next")


def _link_id(obj: dict, key: str):
    try:
        return re.search(r"/(\d+)$", obj[key]["links"]["self"]).group(1)
    except Exception:
        return None


def _created_after_query(window_start: date) -> str:
    return urllib.parse.quote(f"created_at:>={window_start.isoformat()}T00:00:00Z")


def _monday_iso(created_at: str) -> str:
    dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    d = dt.date()
    return (d - timedelta(days=d.weekday())).isoformat()


def _new_patient_ids(window_start: date) -> set:
    """Patients whose Cliniko record was created on/after window_start (i.e. new
    to the system in this window). Only ids are read — no names or contact data."""
    q = _created_after_query(window_start)
    ids = set()
    for p in _paginate(f"/patients?per_page=100&q[]={q}", "patients"):
        ids.add(str(p["id"]))
    return ids


def new_patients_by_week(window_start: date) -> dict:
    """Returns {monday_iso: {"d2": int, "d7": int}} for new-patient first bookings.

    A new patient is counted once, in the ISO week their first booking was created,
    attributed to the location of that first booking. HSE-type first bookings and
    corporate/on-site locations are excluded.
    """
    new_patients = _new_patient_ids(window_start)
    if not new_patients:
        return {}

    # Earliest booking (by created_at) per new patient, across all businesses.
    first: dict[str, tuple] = {}
    q = _created_after_query(window_start)
    for appt in _paginate(
        f"/individual_appointments?per_page=100&q[]={q}", "individual_appointments"
    ):
        pid = _link_id(appt, "patient")
        if pid not in new_patients:
            continue
        created = appt.get("created_at")
        if not created:
            continue
        prev = first.get(pid)
        if prev is None or created < prev[0]:
            first[pid] = (created, _link_id(appt, "business"), _link_id(appt, "appointment_type"))

    buckets: dict[str, dict] = {}
    for _pid, (created, business_id, type_id) in first.items():
        if type_id in HSE_TYPE_IDS:
            continue
        if business_id == D2_BUSINESS:
            loc = "d2"
        elif business_id == D7_BUSINESS:
            loc = "d7"
        else:
            continue
        week = buckets.setdefault(_monday_iso(created), {"d2": 0, "d7": 0})
        week[loc] += 1
    return buckets
