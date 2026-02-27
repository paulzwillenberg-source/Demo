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


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["topics"] = json.loads(d.get("topics") or "[]")
    d["confirmed"] = bool(d.get("confirmed"))
    d["active"] = bool(d.get("active"))
    return d
