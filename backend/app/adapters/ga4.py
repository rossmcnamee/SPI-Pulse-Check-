"""GA4 (Website & SEO) adapter.

LIVE WIRING (Phase 6, on creds): GA4 Data API runReport, dimensions
sessionSourceMedium + week, metrics sessions/totalUsers/keyEvents, plus named
key events for callback / book-online / info-pack. Credentials: service-account
JSON + GA4_PROPERTY_ID.
"""
from __future__ import annotations

from .base import MockSourceAdapter


class GA4Adapter(MockSourceAdapter):
    source = "ga4"
    channel = "seo"
