"""GoHighLevel / LeadConnector adapter (Funnel tab) — ties ad spend to bookings.

LIVE WIRING (Phase 6, optional): GHL API opportunities + contacts by source and
tag, pipeline stages, lead->patient conversion. Credentials: GHL location API key
or OAuth.
"""
from __future__ import annotations

from .base import MockSourceAdapter


class GoHighLevelAdapter(MockSourceAdapter):
    source = "ghl"
    channel = "funnel"
