"""Minimal public data engine for the Vercel-hosted dashboard.

This is a STRIPPED-DOWN FastAPI app (no DB, no auth, no static files, no slow
backfill-on-startup) that exposes only the two read-only endpoints the React
dashboard needs:

    GET /api/new-patients?weeks=12   (Cliniko)
    GET /api/ad-rows?weeks=52        (Google Ads + Meta + YouTube)

It exists so Render can run a persistent server able to absorb the ~45s Cliniko
crawl (which would time out on Vercel's 10s serverless limit), while the heavy
full app (app.main) with its Postgres + snapshot history stays out of the
hot path. Results are cached in-process with a 30-min TTL (see routes/live.py).

Run:  python -m uvicorn app.live_app:app --host 0.0.0.0 --port $PORT

CORS is wide-open for GET because the responses are non-sensitive aggregate
metrics (no PII) and the dashboard is shared publicly by link anyway. All
platform credentials are read from the process environment (set in Render's
dashboard in production; loaded from backend/.env for local runs).
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.live import router as live_router


def _load_dotenv() -> None:
    """Local convenience: populate env from backend/.env if present.

    No-op in production (Render injects real env vars and ships no .env file).
    Mirrors the loader in scripts/new_patients_json.py so local and deployed
    runs read credentials identically.
    """
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if not os.path.exists(path):
        return
    for line in open(path):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv()

app = FastAPI(title="SPI Dashboard Data Engine", docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(live_router, prefix="/api")


@app.get("/healthz")
def healthz():
    return {"ok": True}
