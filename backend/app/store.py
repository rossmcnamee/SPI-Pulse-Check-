"""Read/write weekly snapshots. Trends read from here (fast, consistent); the
current week is fetched live from adapters at request time."""
from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from .db import SessionLocal, engine
from .models import WeeklySnapshot
from .schemas import EntitySnapshot


def upsert_snapshots(snaps: list[EntitySnapshot]) -> int:
    """Idempotent insert keyed by (source, entity_id, week_start)."""
    if not snaps:
        return 0
    written = 0
    with SessionLocal() as session:
        for s in snaps:
            row = {
                "source": s.source, "channel": s.channel,
                "entity_id": s.entity_id, "entity_name": s.entity_name,
                "location": s.location, "week_start": date.fromisoformat(s.week_start),
                "metrics": s.metrics,
            }
            if engine.dialect.name == "sqlite":
                stmt = sqlite_insert(WeeklySnapshot).values(**row)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["source", "entity_id", "week_start"],
                    set_={"metrics": row["metrics"], "entity_name": row["entity_name"]},
                )
                session.execute(stmt)
            else:
                existing = session.scalar(select(WeeklySnapshot).where(
                    WeeklySnapshot.source == s.source,
                    WeeklySnapshot.entity_id == s.entity_id,
                    WeeklySnapshot.week_start == row["week_start"],
                ))
                if existing:
                    existing.metrics = row["metrics"]
                    existing.entity_name = row["entity_name"]
                else:
                    session.add(WeeklySnapshot(**row))
            written += 1
        session.commit()
    return written


def get_channel_snapshots(channel: str) -> list[EntitySnapshot]:
    with SessionLocal() as session:
        rows = session.scalars(
            select(WeeklySnapshot)
            .where(WeeklySnapshot.channel == channel)
            .order_by(WeeklySnapshot.week_start)
        ).all()
    return [_to_schema(r) for r in rows]


def has_data() -> bool:
    with SessionLocal() as session:
        return session.scalar(select(WeeklySnapshot.id).limit(1)) is not None


def _to_schema(r: WeeklySnapshot) -> EntitySnapshot:
    return EntitySnapshot(
        source=r.source, channel=r.channel, entity_id=r.entity_id,
        entity_name=r.entity_name, week_start=r.week_start.isoformat(),
        metrics=r.metrics, location=r.location,
    )
