"""
Unit tests for src/dedup/store.py (SQLite path only — Redis is mocked).
"""
import os
import pytest

from src.dedup.store import DedupStore


@pytest.fixture()
def store(tmp_path, monkeypatch):
    """Return a DedupStore backed by a temporary SQLite DB."""
    db_file = str(tmp_path / "test.db")
    monkeypatch.setenv("DATABASE_PATH", db_file)

    # Ensure the table exists
    import sqlite3
    os.makedirs(str(tmp_path), exist_ok=True)
    conn = sqlite3.connect(db_file)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS seen_listings (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            listing_id TEXT NOT NULL,
            source_slug TEXT NOT NULL,
            seen_at TEXT NOT NULL,
            UNIQUE(user_id, listing_id)
        )
        """
    )
    conn.commit()
    conn.close()

    # Force SQLite-only (no Redis)
    monkeypatch.setattr("config.settings.REDIS_URL", "")
    return DedupStore()


def test_unseen_listing_returns_false(store):
    assert store.is_seen("user1", "listing_abc") is False


def test_mark_seen_then_is_seen(store):
    store.mark_seen("user1", "listing_abc", "beyond_retro")
    assert store.is_seen("user1", "listing_abc") is True


def test_different_users_independent(store):
    store.mark_seen("user1", "listing_abc", "thrifted")
    assert store.is_seen("user2", "listing_abc") is False


def test_different_listings_independent(store):
    store.mark_seen("user1", "listing_abc", "beyond_retro")
    assert store.is_seen("user1", "listing_xyz") is False


def test_mark_seen_idempotent(store):
    store.mark_seen("user1", "listing_abc", "beyond_retro")
    store.mark_seen("user1", "listing_abc", "beyond_retro")  # should not raise
    assert store.is_seen("user1", "listing_abc") is True


def test_redis_failure_falls_back_to_sqlite(tmp_path, monkeypatch):
    """When Redis is configured but unreachable, SQLite fallback is used."""
    db_file = str(tmp_path / "fallback.db")
    monkeypatch.setenv("DATABASE_PATH", db_file)

    import sqlite3
    conn = sqlite3.connect(db_file)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS seen_listings (
            id TEXT PRIMARY KEY, user_id TEXT, listing_id TEXT,
            source_slug TEXT, seen_at TEXT, UNIQUE(user_id, listing_id)
        )
        """
    )
    conn.commit()
    conn.close()

    # Point at a definitely-unreachable Redis
    monkeypatch.setattr("config.settings.REDIS_URL", "redis://localhost:19999/0")
    store = DedupStore()  # Redis ping will fail → SQLite fallback
    assert store._redis is None

    store.mark_seen("u", "l", "beyond_retro")
    assert store.is_seen("u", "l") is True
