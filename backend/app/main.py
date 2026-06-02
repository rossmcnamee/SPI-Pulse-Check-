"""FastAPI entrypoint: mounts the API, serves the static frontend, and ensures
the 26-week snapshot history exists on first boot.

Run:  python -m uvicorn app.main:app --port 8000
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .db import init_db
from .jobs import backfill
from .routes.api import router as api_router
from .store import has_data

FRONTEND_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
)

app = FastAPI(title="SPI Marketing Pulse")
app.include_router(api_router, prefix="/api")


@app.on_event("startup")
def _startup() -> None:
    init_db()
    if not has_data():
        summary = backfill.run()
        print(f"[startup] backfilled {sum(summary.values())} snapshots")


@app.get("/healthz")
def healthz():
    return {"ok": True}


# Static frontend (SPA). Mounted last so /api and /healthz take precedence.
if os.path.isdir(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    @app.get("/")
    def index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/{path:path}")
    def spa(path: str):
        candidate = os.path.join(FRONTEND_DIR, path)
        if os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
