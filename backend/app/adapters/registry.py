"""Resolves a channel to its adapter. Today every source returns mock data;
flipping a per-source flag in config (e.g. CLINIKO_LIVE=true) is where a live
adapter would be returned instead."""
from __future__ import annotations

from .cliniko import ClinikoAdapter
from .ga4 import GA4Adapter
from .gbp import GoogleBusinessProfileAdapter
from .ghl import GoHighLevelAdapter
from .google_ads import GoogleAdsAdapter
from .meta import MetaAdapter
from .youtube import YouTubeAdapter

# channel_key -> adapter instance
_ADAPTERS = {
    "cliniko": ClinikoAdapter(),
    "google_ads": GoogleAdsAdapter(),
    "meta": MetaAdapter(),
    "youtube": YouTubeAdapter(),
    "gbp": GoogleBusinessProfileAdapter(),
    "seo": GA4Adapter(),
    "funnel": GoHighLevelAdapter(),
}


def get_adapter(channel: str):
    if channel not in _ADAPTERS:
        raise KeyError(channel)
    return _ADAPTERS[channel]


def all_channels() -> list[str]:
    return list(_ADAPTERS.keys())
