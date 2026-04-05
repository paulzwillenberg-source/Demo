"""
Listing deduplication store.

Redis is the primary backend (30-day TTL per user+listing pair).
Falls back automatically to SQLite when REDIS_URL is not configured.
Both stores are written simultaneously when Redis is available.
"""
from __future__ import annotations

import logging
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)

_TTL_DAYS = 30  # listings resurface after 30 days if still unsold


def _db_path() -> str:
    """Read DATABASE_PATH at call time so tests can override via monkeypatch."""
    return os.getenv("DATABASE_PATH", "data/bulletin.db")


def _ensure_dir() -> None:
    path = _db_path()
    dir_ = os.path.dirname(path)
    if dir_:
        os.makedirs(dir_, exist_ok=True)


@contextmanager
def _get_conn():
    _ensure_dir()
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _connect_redis():
    """Return a Redis client or None if unavailable/unconfigured."""
    if not settings.REDIS_URL:
        return None
    try:
        import redis
        client = redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        client.ping()
        return client
    except Exception as exc:
        logger.warning("Redis unavailable (%s); using SQLite dedup fallback.", exc)
        return None


class DedupStore:
    """
    Two-tier deduplication store.

    Usage::

        store = DedupStore()
        if not store.is_seen(user_id, listing_id):
            store.mark_seen(user_id, listing_id, source_slug)
            # ... send alert
    """

    def __init__(self, redis_url: Optional[str] = None) -> None:
        # Allow explicit redis_url override for testing
        if redis_url is not None:
            original = settings.REDIS_URL
            settings.REDIS_URL = redis_url
            self._redis = _connect_redis()
            settings.REDIS_URL = original
        else:
            self._redis = _connect_redis()

        if self._redis:
            logger.debug("DedupStore: using Redis primary + SQLite backup.")
        else:
            logger.debug("DedupStore: using SQLite only.")

    def is_seen(self, user_id: str, listing_id: str) -> bool:
        """Return True if this user has already been alerted about this listing."""
        key = f"seen:{user_id}:{listing_id}"
        if self._redis:
            try:
                return bool(self._redis.get(key))
            except Exception as exc:
                logger.warning("Redis get failed (%s); falling back to SQLite.", exc)
        return self._sqlite_is_seen(user_id, listing_id)

    def mark_seen(self, user_id: str, listing_id: str, source_slug: str = "") -> None:
        """Record that this user has been alerted about this listing."""
        key = f"seen:{user_id}:{listing_id}"
        if self._redis:
            try:
                self._redis.setex(key, _TTL_DAYS * 86400, "1")
            except Exception as exc:
                logger.warning("Redis setex failed (%s); continuing with SQLite.", exc)
        self._sqlite_mark_seen(user_id, listing_id, source_slug)

    # ── SQLite backend ────────────────────────────────────────────────────────

    def _sqlite_is_seen(self, user_id: str, listing_id: str) -> bool:
        try:
            with _get_conn() as conn:
                row = conn.execute(
                    "SELECT id FROM seen_listings WHERE user_id = ? AND listing_id = ?",
                    (user_id, listing_id),
                ).fetchone()
            return row is not None
        except Exception as exc:
            logger.error("SQLite dedup check failed: %s", exc)
            return False  # Fail open — better to alert twice than miss an alert

    def _sqlite_mark_seen(self, user_id: str, listing_id: str, source_slug: str) -> None:
        now = datetime.now(tz=timezone.utc).isoformat()
        try:
            with _get_conn() as conn:
                conn.execute(
                    "INSERT OR IGNORE INTO seen_listings "
                    "(id, user_id, listing_id, source_slug, seen_at) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (str(uuid.uuid4()), user_id, listing_id, source_slug, now),
                )
        except Exception as exc:
            logger.error("SQLite dedup write failed: %s", exc)
