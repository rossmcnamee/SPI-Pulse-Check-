"""HTTP API. Auth routes are public; all data routes require a valid session."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel

from .. import services
from ..auth import (COOKIE_NAME, check_password, issue_token, require_auth, token_valid)
from ..channels_config import CHANNELS, METRIC_META
from ..config import get_settings

router = APIRouter()


# ---- auth ------------------------------------------------------------------

class LoginIn(BaseModel):
    password: str


@router.post("/login")
def login(body: LoginIn, response: Response):
    if not check_password(body.password):
        raise HTTPException(status_code=401, detail="Incorrect password")
    settings = get_settings()
    response.set_cookie(
        key=COOKIE_NAME, value=issue_token(), httponly=True, samesite="lax",
        secure=settings.cookie_secure, max_age=settings.session_max_age, path="/",
    )
    return {"ok": True}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me")
def me(spi_session: Optional[str] = Cookie(default=None)):
    return {"authenticated": token_valid(spi_session)}


@router.get("/config")
def config():
    return {
        "goal": 100,
        "goal_label": "100 new patients / week by December 2026",
        "channels": [{"key": k, "label": v["label"]} for k, v in CHANNELS.items()],
        "metric_meta": METRIC_META,
    }


# ---- data (protected) ------------------------------------------------------

def _now():
    return get_settings().app_now


@router.get("/overview", dependencies=[Depends(require_auth)])
def overview():
    return services.build_overview(_now())


@router.get("/goal", dependencies=[Depends(require_auth)])
def goal():
    return services.build_goal_banner(_now())


@router.get("/channels/{channel}", dependencies=[Depends(require_auth)])
def channel_view(channel: str):
    if channel not in CHANNELS:
        raise HTTPException(status_code=404, detail="Unknown channel")
    return services.build_channel_view(channel, _now())


@router.get("/channels/{channel}/entities/{entity_id}", dependencies=[Depends(require_auth)])
def entity_detail(channel: str, entity_id: str):
    if channel not in CHANNELS:
        raise HTTPException(status_code=404, detail="Unknown channel")
    try:
        return services.build_entity_detail(channel, entity_id, _now())
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown entity")
