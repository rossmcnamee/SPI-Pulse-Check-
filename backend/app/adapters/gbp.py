"""Google Business Profile adapter (Dublin 2 + Dublin 7). Reviews/rating are the
biggest acquisition driver, so they're surfaced prominently in the UI.

LIVE WIRING (Phase 6, on creds): Business Profile Performance API for insights
(views/searches/calls/directions/website clicks) + Reviews endpoint for count
and average rating per location. Credentials: Google OAuth + location IDs.
"""
from __future__ import annotations

from .base import MockSourceAdapter


class GoogleBusinessProfileAdapter(MockSourceAdapter):
    source = "gbp"
    channel = "gbp"
