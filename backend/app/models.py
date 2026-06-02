"""Stored weekly snapshots — one row per source/entity/week."""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import JSON, Date, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class WeeklySnapshot(Base):
    __tablename__ = "weekly_snapshots"
    __table_args__ = (
        UniqueConstraint("source", "entity_id", "week_start", name="uq_snapshot"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(40), index=True)
    channel: Mapped[str] = mapped_column(String(40), index=True)
    entity_id: Mapped[str] = mapped_column(String(80), index=True)
    entity_name: Mapped[str] = mapped_column(String(160))
    location: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    week_start: Mapped[date] = mapped_column(Date, index=True)
    metrics: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
