"""Shared-team-password auth with a signed, httponly session cookie.

The password and signing key live only in env vars; the cookie carries a signed
marker (no credential), verified on every protected request.
"""
from __future__ import annotations

import hmac
from typing import Optional

from fastapi import Cookie, HTTPException
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from .config import get_settings

COOKIE_NAME = "spi_session"
_SALT = "spi-session-v1"


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().secret_key, salt=_SALT)


def check_password(candidate: str) -> bool:
    expected = get_settings().team_password
    return hmac.compare_digest(candidate.encode(), expected.encode())


def issue_token() -> str:
    return _serializer().dumps({"role": "team"})


def token_valid(token: str | None) -> bool:
    if not token:
        return False
    try:
        _serializer().loads(token, max_age=get_settings().session_max_age)
        return True
    except (BadSignature, SignatureExpired):
        return False


def require_auth(spi_session: Optional[str] = Cookie(default=None)) -> None:
    """FastAPI dependency guarding protected routes."""
    if not token_valid(spi_session):
        raise HTTPException(status_code=401, detail="Not authenticated")
