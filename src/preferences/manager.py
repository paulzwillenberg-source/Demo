"""
User preferences and subscriber management.

Uses a simple SQLite database (via Python's built-in sqlite3) so there are
no ORM dependencies. In production, swap for PostgreSQL or another RDBMS.
"""
from __future__ import annotations

import json
import logging
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

_DB_PATH = os.getenv("DATABASE_PATH", "data/bulletin.db")


def _ensure_dir() -> None:
    os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)


@contextmanager
def _get_conn():
    _ensure_dir()
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Create database tables if they don't exist."""
    with _get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id          TEXT PRIMARY KEY,
                email       TEXT UNIQUE NOT NULL,
                name        TEXT NOT NULL DEFAULT '',
                topics      TEXT NOT NULL DEFAULT '[]',
                confirmed   INTEGER NOT NULL DEFAULT 0,
                active      INTEGER NOT NULL DEFAULT 1,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS delivery_log (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                sent_at     TEXT NOT NULL,
                success     INTEGER NOT NULL,
                message     TEXT
            )
            """
        )
        # ── Vintage Scout tables ──────────────────────────────────────────
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS vintage_preferences (
                id              TEXT PRIMARY KEY,
                user_id         TEXT NOT NULL UNIQUE,
                brands          TEXT NOT NULL DEFAULT '[]',
                sizes           TEXT NOT NULL DEFAULT '[]',
                price_min       REAL,
                price_max       REAL,
                keywords        TEXT NOT NULL DEFAULT '[]',
                categories      TEXT NOT NULL DEFAULT '[]',
                enabled_sites   TEXT NOT NULL DEFAULT '[]',
                alert_format    TEXT NOT NULL DEFAULT 'email_digest',
                whatsapp_number TEXT,
                active          INTEGER NOT NULL DEFAULT 1,
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS seen_listings (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                listing_id  TEXT NOT NULL,
                source_slug TEXT NOT NULL,
                seen_at     TEXT NOT NULL,
                UNIQUE(user_id, listing_id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS digest_queue (
                id           TEXT PRIMARY KEY,
                user_id      TEXT NOT NULL,
                listing_json TEXT NOT NULL,
                queued_at    TEXT NOT NULL,
                sent         INTEGER NOT NULL DEFAULT 0,
                sent_at      TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS vintage_alert_log (
                id           TEXT PRIMARY KEY,
                user_id      TEXT NOT NULL,
                listing_id   TEXT NOT NULL,
                alert_format TEXT NOT NULL,
                sent_at      TEXT NOT NULL,
                success      INTEGER NOT NULL,
                message      TEXT
            )
            """
        )
    logger.info("Database initialized at %s.", _DB_PATH)


# ─── User CRUD ────────────────────────────────────────────────────────────────

def create_user(email: str, name: str, topics: list[str]) -> dict:
    """Register a new subscriber. Returns the user dict."""
    now = datetime.now(tz=timezone.utc).isoformat()
    user_id = str(uuid.uuid4())
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO users (id, email, name, topics, confirmed, active, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, 0, 1, ?, ?)",
            (user_id, email.lower().strip(), name.strip(), json.dumps(topics), now, now),
        )
    logger.info("Created user id=%s email=%s.", user_id, email)
    return get_user_by_id(user_id)


def get_user_by_id(user_id: str) -> Optional[dict]:
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _row_to_dict(row) if row else None


def get_user_by_email(email: str) -> Optional[dict]:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (email.lower().strip(),)
        ).fetchone()
    return _row_to_dict(row) if row else None


def get_all_active_users() -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM users WHERE active = 1 AND confirmed = 1"
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def update_preferences(user_id: str, name: str | None = None, topics: list[str] | None = None) -> Optional[dict]:
    now = datetime.now(tz=timezone.utc).isoformat()
    updates = ["updated_at = ?"]
    params: list = [now]

    if name is not None:
        updates.append("name = ?")
        params.append(name.strip())
    if topics is not None:
        updates.append("topics = ?")
        params.append(json.dumps(topics))

    params.append(user_id)
    with _get_conn() as conn:
        conn.execute(
            f"UPDATE users SET {', '.join(updates)} WHERE id = ?",
            params,
        )
    return get_user_by_id(user_id)


def confirm_user(user_id: str) -> None:
    now = datetime.now(tz=timezone.utc).isoformat()
    with _get_conn() as conn:
        conn.execute(
            "UPDATE users SET confirmed = 1, updated_at = ? WHERE id = ?",
            (now, user_id),
        )
    logger.info("User %s confirmed.", user_id)


def deactivate_user(user_id: str) -> None:
    now = datetime.now(tz=timezone.utc).isoformat()
    with _get_conn() as conn:
        conn.execute(
            "UPDATE users SET active = 0, updated_at = ? WHERE id = ?",
            (now, user_id),
        )
    logger.info("User %s deactivated (unsubscribed).", user_id)


# ─── Delivery log ─────────────────────────────────────────────────────────────

def log_delivery(user_id: str, success: bool, message: str = "") -> None:
    now = datetime.now(tz=timezone.utc).isoformat()
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO delivery_log (id, user_id, sent_at, success, message) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), user_id, now, int(success), message),
        )


def get_delivery_stats() -> dict:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) as total, SUM(success) as successful FROM delivery_log"
        ).fetchone()
    total = row["total"] or 0
    successful = row["successful"] or 0
    return {
        "total": total,
        "successful": successful,
        "failed": total - successful,
        "success_rate": round(successful / total * 100, 2) if total else 0,
    }


# ─── Vintage Scout CRUD ───────────────────────────────────────────────────────

def upsert_vintage_preferences(
    user_id: str,
    brands: list[str] | None = None,
    sizes: list[str] | None = None,
    price_min: float | None = None,
    price_max: float | None = None,
    keywords: list[str] | None = None,
    categories: list[str] | None = None,
    enabled_sites: list[str] | None = None,
    alert_format: str | None = None,
    whatsapp_number: str | None = None,
) -> dict:
    """Insert or update vintage preferences for a user."""
    now = datetime.now(tz=timezone.utc).isoformat()
    existing = get_vintage_preferences(user_id)

    if existing is None:
        pref_id = str(uuid.uuid4())
        with _get_conn() as conn:
            conn.execute(
                """
                INSERT INTO vintage_preferences
                    (id, user_id, brands, sizes, price_min, price_max,
                     keywords, categories, enabled_sites, alert_format,
                     whatsapp_number, active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                """,
                (
                    pref_id, user_id,
                    json.dumps(brands or []),
                    json.dumps(sizes or []),
                    price_min, price_max,
                    json.dumps(keywords or []),
                    json.dumps(categories or []),
                    json.dumps(enabled_sites or []),
                    alert_format or "email_digest",
                    whatsapp_number,
                    now, now,
                ),
            )
    else:
        updates = ["updated_at = ?"]
        params: list = [now]
        if brands is not None:
            updates.append("brands = ?"); params.append(json.dumps(brands))
        if sizes is not None:
            updates.append("sizes = ?"); params.append(json.dumps(sizes))
        if price_min is not None:
            updates.append("price_min = ?"); params.append(price_min)
        if price_max is not None:
            updates.append("price_max = ?"); params.append(price_max)
        if keywords is not None:
            updates.append("keywords = ?"); params.append(json.dumps(keywords))
        if categories is not None:
            updates.append("categories = ?"); params.append(json.dumps(categories))
        if enabled_sites is not None:
            updates.append("enabled_sites = ?"); params.append(json.dumps(enabled_sites))
        if alert_format is not None:
            updates.append("alert_format = ?"); params.append(alert_format)
        if whatsapp_number is not None:
            updates.append("whatsapp_number = ?"); params.append(whatsapp_number)
        params.append(user_id)
        with _get_conn() as conn:
            conn.execute(
                f"UPDATE vintage_preferences SET {', '.join(updates)} WHERE user_id = ?",
                params,
            )

    return get_vintage_preferences(user_id)


def get_vintage_preferences(user_id: str) -> Optional[dict]:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM vintage_preferences WHERE user_id = ?", (user_id,)
        ).fetchone()
    return _vintage_prefs_row_to_dict(row) if row else None


def get_all_vintage_users() -> list[dict]:
    """Return all users who have active vintage preferences."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM vintage_preferences WHERE active = 1"
        ).fetchall()
    return [_vintage_prefs_row_to_dict(r) for r in rows]


# ─── Dedup helpers ────────────────────────────────────────────────────────────

def is_listing_seen(user_id: str, listing_id: str) -> bool:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM seen_listings WHERE user_id = ? AND listing_id = ?",
            (user_id, listing_id),
        ).fetchone()
    return row is not None


def mark_listing_seen(user_id: str, listing_id: str, source_slug: str) -> None:
    now = datetime.now(tz=timezone.utc).isoformat()
    with _get_conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO seen_listings (id, user_id, listing_id, source_slug, seen_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), user_id, listing_id, source_slug, now),
        )


# ─── Digest queue ─────────────────────────────────────────────────────────────

def queue_digest_item(user_id: str, listing_json: str) -> None:
    now = datetime.now(tz=timezone.utc).isoformat()
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO digest_queue (id, user_id, listing_json, queued_at, sent) "
            "VALUES (?, ?, ?, ?, 0)",
            (str(uuid.uuid4()), user_id, listing_json, now),
        )


def get_pending_digest_items(user_id: str) -> list[str]:
    """Return list of JSON strings for unsent digest items for a user."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT listing_json FROM digest_queue WHERE user_id = ? AND sent = 0 "
            "ORDER BY queued_at ASC",
            (user_id,),
        ).fetchall()
    return [r["listing_json"] for r in rows]


def mark_digest_sent(user_id: str) -> None:
    now = datetime.now(tz=timezone.utc).isoformat()
    with _get_conn() as conn:
        conn.execute(
            "UPDATE digest_queue SET sent = 1, sent_at = ? WHERE user_id = ? AND sent = 0",
            (now, user_id),
        )


# ─── Vintage alert log ────────────────────────────────────────────────────────

def log_vintage_alert(
    user_id: str,
    listing_id: str,
    alert_format: str,
    success: bool,
    message: str = "",
) -> None:
    now = datetime.now(tz=timezone.utc).isoformat()
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO vintage_alert_log "
            "(id, user_id, listing_id, alert_format, sent_at, success, message) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), user_id, listing_id, alert_format, now, int(success), message),
        )


def get_vintage_alert_stats(user_id: str) -> dict:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) as total, SUM(success) as successful "
            "FROM vintage_alert_log WHERE user_id = ?",
            (user_id,),
        ).fetchone()
    total = row["total"] or 0
    successful = row["successful"] or 0
    return {
        "total": total,
        "successful": successful,
        "failed": total - successful,
        "success_rate": round(successful / total * 100, 2) if total else 0,
    }


def get_recent_vintage_alerts(user_id: str, limit: int = 20) -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM vintage_alert_log WHERE user_id = ? "
            "ORDER BY sent_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["topics"] = json.loads(d.get("topics") or "[]")
    d["confirmed"] = bool(d.get("confirmed"))
    d["active"] = bool(d.get("active"))
    return d


def _vintage_prefs_row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    for key in ("brands", "sizes", "keywords", "categories", "enabled_sites"):
        d[key] = json.loads(d.get(key) or "[]")
    d["active"] = bool(d.get("active"))
    return d
