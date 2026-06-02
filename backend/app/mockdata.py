"""Deterministic mock data for every source.

Seeded by entity + metric + week index so values are stable across reloads but
look realistic (gentle upward trend + weekly noise). This is the single place
the mock adapters draw from; replacing a source with live data means swapping
its adapter, not touching this file.
"""
from __future__ import annotations

import hashlib
from datetime import date

# ---- entity catalogue ------------------------------------------------------

LOC_D2 = "Dublin 2"
LOC_D7 = "Dublin 7"

GOOGLE_ADS_CAMPAIGNS = [
    ("ga-brand", "Brand – Sports Physio Ireland"),
    ("ga-injury-d2", "Sports Injury – Dublin 2"),
    ("ga-injury-d7", "Sports Injury – Dublin 7"),
    ("ga-physio-near-me", "Physio Near Me"),
    ("ga-acl", "Knee & ACL Rehab"),
]

META_CAMPAIGNS = [
    ("fb-leadgen", "Lead Gen – Free Assessment"),
    ("fb-retarget", "Retargeting – Website Visitors"),
    ("fb-gaa", "GAA Partnership – Cabra"),
    ("fb-marathon", "Marathon Prep – Runners"),
]

YOUTUBE_CAMPAIGNS = [
    ("yt-team", "Meet the Team"),
    ("yt-acl-story", "ACL Recovery Story"),
    ("yt-runners-knee", "Runner's Knee Explainer"),
]

GBP_LOCATIONS = [
    ("gbp-d2", "SPI – Dublin 2", LOC_D2),
    ("gbp-d7", "SPI – Dublin 7 (Naomh Fionnbarra GAA)", LOC_D7),
]

SEO_SOURCES = [
    ("seo-organic", "Organic Search"),
    ("seo-direct", "Direct"),
    ("seo-paid", "Paid Search"),
    ("seo-referral", "Referral"),
    ("seo-social", "Social"),
]

FUNNEL_SOURCES = [
    ("fn-google-ads", "Google Ads"),
    ("fn-meta", "Meta (FB/IG)"),
    ("fn-organic", "Organic / SEO"),
    ("fn-gbp", "Google Business Profile"),
    ("fn-referral", "Referral / GP"),
]

INJURY_TAGS = [
    ("ACL / Knee", 0.22),
    ("Running / Lower Limb", 0.20),
    ("Back & Neck", 0.18),
    ("Shoulder", 0.14),
    ("Sports – GAA", 0.16),
    ("Other", 0.10),
]

PIPELINE_STAGES = ["New Lead", "Contacted", "Assessment Booked", "Attended", "New Patient"]


# ---- deterministic helpers -------------------------------------------------

def _rng(*parts) -> float:
    h = hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def _series(seed: str, n: int, start: float, end: float, vol: float) -> list[float]:
    out = []
    for i in range(n):
        t = i / (n - 1) if n > 1 else 1.0
        trend = start + (end - start) * t
        noise = (_rng(seed, i) - 0.5) * 2 * vol * trend
        out.append(max(0.0, trend + noise))
    return out


def _round(values: list[float], digits: int = 0) -> list[float]:
    return [round(v, digits) for v in values]


# ---- per-source builders ---------------------------------------------------
# Each returns: { entity_id: {"name", "location"?, "weeks": {metric: [values]}} }

def _cliniko(n: int) -> dict:
    d2 = _round(_series("cliniko-d2", n, 29, 34, 0.07))
    d7 = _round(_series("cliniko-d7", n, 23, 28, 0.08))
    combined = [a + b for a, b in zip(d2, d7)]
    return {
        "combined": {"name": "SPI – Both Locations", "weeks": {"new_patients": combined}},
        "dublin-2": {"name": "Dublin 2", "location": LOC_D2, "weeks": {"new_patients": d2}},
        "dublin-7": {"name": "Dublin 7", "location": LOC_D7, "weeks": {"new_patients": d7}},
    }


def _google_ads(n: int) -> dict:
    out = {}
    bases = {
        "ga-brand": (180, 1.0),
        "ga-injury-d2": (420, 1.3),
        "ga-injury-d7": (360, 1.25),
        "ga-physio-near-me": (300, 1.15),
        "ga-acl": (240, 1.4),
    }
    for cid, name in GOOGLE_ADS_CAMPAIGNS:
        base, growth = bases[cid]
        spend = _round(_series(cid + "-spend", n, base, base * growth, 0.12), 2)
        impressions = _round(_series(cid + "-imp", n, base * 22, base * 28, 0.15))
        clicks = _round(_series(cid + "-clk", n, base * 0.9, base * 1.2, 0.14))
        conversions = _round(_series(cid + "-cv", n, base * 0.07, base * 0.11, 0.18), 1)
        bookings = [round(c * 0.55, 1) for c in conversions]
        cpc = [round(s / c, 2) if c else 0 for s, c in zip(spend, conversions)]
        cvr = [round(c / k * 100, 2) if k else 0 for c, k in zip(conversions, clicks)]
        out[cid] = {"name": name, "weeks": {
            "spend": spend, "impressions": impressions, "clicks": clicks,
            "conversions": conversions, "bookings": bookings,
            "cost_per_conversion": cpc, "conversion_rate": cvr,
        }}
    return out


def _meta(n: int) -> dict:
    out = {}
    bases = {
        "fb-leadgen": 260, "fb-retarget": 120, "fb-gaa": 150, "fb-marathon": 110,
    }
    for cid, name in META_CAMPAIGNS:
        base = bases[cid]
        spend = _round(_series(cid + "-spend", n, base, base * 1.2, 0.13), 2)
        reach = _round(_series(cid + "-reach", n, base * 90, base * 120, 0.16))
        impressions = [round(r * 1.6) for r in reach]
        clicks = _round(_series(cid + "-clk", n, base * 1.1, base * 1.5, 0.15))
        leads = _round(_series(cid + "-lead", n, base * 0.10, base * 0.16, 0.2), 1)
        cpl = [round(s / l, 2) if l else 0 for s, l in zip(spend, leads)]
        out[cid] = {"name": name, "weeks": {
            "spend": spend, "reach": reach, "impressions": impressions,
            "clicks": clicks, "leads": leads, "cost_per_lead": cpl,
        }}
    return out


def _youtube(n: int) -> dict:
    out = {}
    bases = {"yt-team": 90, "yt-acl-story": 120, "yt-runners-knee": 70}
    for cid, name in YOUTUBE_CAMPAIGNS:
        base = bases[cid]
        spend = _round(_series(cid + "-spend", n, base, base * 1.25, 0.14), 2)
        views = _round(_series(cid + "-views", n, base * 60, base * 95, 0.17))
        impressions = [round(v * 2.4) for v in views]
        view_rate = [round(v / i * 100, 1) if i else 0 for v, i in zip(views, impressions)]
        cpv = [round(s / v, 3) if v else 0 for s, v in zip(spend, views)]
        conversions = _round(_series(cid + "-cv", n, base * 0.03, base * 0.06, 0.22), 1)
        out[cid] = {"name": name, "weeks": {
            "spend": spend, "views": views, "impressions": impressions,
            "view_rate": view_rate, "cost_per_view": cpv, "conversions": conversions,
        }}
    return out


def _gbp(n: int) -> dict:
    out = {}
    cfg = {
        "gbp-d2": (520, 4.8, 0.82),   # higher base location
        "gbp-d7": (430, 4.9, 0.86),
    }
    for cid, name, loc in GBP_LOCATIONS:
        base, rating_end, _ = cfg[cid]
        profile_views = _round(_series(cid + "-pv", n, base, base * 1.3, 0.12))
        searches = _round(_series(cid + "-srch", n, base * 1.4, base * 1.7, 0.12))
        calls = _round(_series(cid + "-call", n, base * 0.05, base * 0.07, 0.18))
        directions = _round(_series(cid + "-dir", n, base * 0.08, base * 0.1, 0.16))
        web_clicks = _round(_series(cid + "-web", n, base * 0.12, base * 0.16, 0.15))
        new_reviews = _round(_series(cid + "-nr", n, 4, 9, 0.3))
        rating = _round(_series(cid + "-rate", n, rating_end - 0.1, rating_end, 0.01), 2)
        # cumulative total reviews
        start_total = 180 if cid == "gbp-d2" else 140
        totals, run = [], start_total
        for nr in new_reviews:
            run += nr
            totals.append(run)
        out[cid] = {"name": name, "location": loc, "weeks": {
            "profile_views": profile_views, "searches": searches, "calls": calls,
            "direction_requests": directions, "website_clicks": web_clicks,
            "new_reviews": new_reviews, "reviews_total": totals, "rating_avg": rating,
        }}
    return out


def _ga4(n: int) -> dict:
    out = {}
    cfg = {
        "seo-organic": (1400, 0.045),
        "seo-direct": (820, 0.03),
        "seo-paid": (760, 0.06),
        "seo-referral": (320, 0.035),
        "seo-social": (410, 0.02),
    }
    for sid, name in SEO_SOURCES:
        base, cvr = cfg[sid]
        sessions = _round(_series(sid + "-sess", n, base, base * 1.25, 0.12))
        users = [round(s * 0.82) for s in sessions]
        conversions = [round(s * cvr, 1) for s in sessions]
        # key conversions split out of total conversions
        callback = [round(c * 0.45, 1) for c in conversions]
        book_online = [round(c * 0.4, 1) for c in conversions]
        info_pack = [round(c * 0.15, 1) for c in conversions]
        out[sid] = {"name": name, "weeks": {
            "sessions": sessions, "users": users, "conversions": conversions,
            "request_callback": callback, "book_online_clicks": book_online,
            "info_pack_downloads": info_pack,
        }}
    return out


def _ghl(n: int) -> dict:
    out = {}
    cfg = {
        "fn-google-ads": (52, 0.30),
        "fn-meta": (40, 0.22),
        "fn-organic": (34, 0.40),
        "fn-gbp": (30, 0.46),
        "fn-referral": (16, 0.55),
    }
    for sid, name in FUNNEL_SOURCES:
        base, conv = cfg[sid]
        leads = _round(_series(sid + "-leads", n, base, base * 1.2, 0.16))
        qualified = [round(l * 0.7) for l in leads]
        booked = [round(l * (conv + 0.1)) for l in leads]
        patients = [round(l * conv, 1) for l in leads]
        rate = [round(p / l * 100, 1) if l else 0 for p, l in zip(patients, leads)]
        out[sid] = {"name": name, "weeks": {
            "leads": leads, "qualified": qualified, "booked": booked,
            "patients": patients, "conversion_rate": rate,
        }}
    return out


_BUILDERS = {
    "cliniko": _cliniko,
    "google_ads": _google_ads,
    "meta": _meta,
    "youtube": _youtube,
    "gbp": _gbp,
    "ga4": _ga4,
    "ghl": _ghl,
}


def build(source: str, n: int) -> dict:
    """Return the mock entity map for a source over the last n weeks."""
    return _BUILDERS[source](n)


def injury_tag_breakdown(now: date) -> list[dict]:
    """Leads by injury-type tag for the current week (funnel extra)."""
    total = 172
    rows = []
    for tag, share in INJURY_TAGS:
        jitter = 0.9 + 0.2 * _rng("injury", tag, now.isoformat())
        rows.append({"tag": tag, "leads": round(total * share * jitter)})
    return rows


def pipeline_snapshot(now: date) -> list[dict]:
    """Current open pipeline by stage (funnel extra)."""
    counts = [210, 150, 96, 74, 61]
    return [{"stage": s, "count": c} for s, c in zip(PIPELINE_STAGES, counts)]
