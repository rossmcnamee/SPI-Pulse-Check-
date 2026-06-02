"""Environment-driven settings. No secrets are ever hardcoded here."""
from __future__ import annotations

import os
from datetime import date
from functools import lru_cache


def _load_dotenv() -> None:
    """Populate os.environ from backend/.env if present (gitignored, local only).

    Existing environment variables win, so Render/CI secrets are never overridden.
    """
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
    path = os.path.join(here, ".env")
    if not os.path.exists(path):
        return
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()


def _as_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    def __init__(self) -> None:
        # Shared-team-password auth (Phase: auth). Override in production via env.
        self.team_password: str = os.getenv("TEAM_PASSWORD", "spi-demo")
        # Used to sign the session cookie. MUST be overridden in production.
        self.secret_key: str = os.getenv("SECRET_KEY", "dev-only-insecure-secret-change-me")
        self.session_max_age: int = int(os.getenv("SESSION_MAX_AGE", str(60 * 60 * 12)))
        self.cookie_secure: bool = _as_bool(os.getenv("COOKIE_SECURE"), False)

        # Snapshot storage. SQLite locally, Postgres on Render.
        self.database_url: str = _normalize_db_url(
            os.getenv("DATABASE_URL", "sqlite:///./spi_dashboard.db")
        )

        # Anchor "now" so the mock demo is deterministic and milestones line up.
        # Real deployments can leave this unset to use the system date.
        self.app_now: date = _parse_date(os.getenv("APP_NOW"), date(2026, 5, 30))

        # Per-source live/mock switches. Cliniko, Google Ads and Meta creds are
        # ready first; the rest stay on mock until their credentials arrive.
        self.use_mock: dict[str, bool] = {
            "cliniko": _as_bool(os.getenv("CLINIKO_LIVE"), False) is False,
            "google_ads": _as_bool(os.getenv("GOOGLE_ADS_LIVE"), False) is False,
            "meta": _as_bool(os.getenv("META_LIVE"), False) is False,
            "youtube": _as_bool(os.getenv("YOUTUBE_LIVE"), False) is False,
            "gbp": _as_bool(os.getenv("GBP_LIVE"), False) is False,
            "ga4": _as_bool(os.getenv("GA4_LIVE"), False) is False,
            "ghl": _as_bool(os.getenv("GHL_LIVE"), False) is False,
        }


def _normalize_db_url(url: str) -> str:
    """Render exposes Postgres as `postgres://...`, but SQLAlchemy 2.0 only
    accepts the `postgresql://` scheme. Normalise so the same URL works as-is."""
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://"):]
    return url


def _parse_date(value: str | None, default: date) -> date:
    if not value:
        return default
    return date.fromisoformat(value)


@lru_cache
def get_settings() -> Settings:
    return Settings()
