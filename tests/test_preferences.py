"""Tests for the user preferences manager."""
import os

import pytest

from src.preferences.manager import (
    confirm_user,
    create_user,
    deactivate_user,
    get_all_active_users,
    get_user_by_email,
    get_user_by_id,
    init_db,
    log_delivery,
    get_delivery_stats,
    update_preferences,
)


@pytest.fixture(autouse=True)
def isolated_db(monkeypatch, tmp_path):
    """Each test gets its own fresh SQLite database."""
    db_path = str(tmp_path / "test_bulletin.db")
    monkeypatch.setattr("src.preferences.manager._DB_PATH", db_path)
    init_db()


class TestUserCrud:
    def test_create_and_retrieve_by_id(self):
        user = create_user("alice@example.com", "Alice", ["news", "business"])
        fetched = get_user_by_id(user["id"])
        assert fetched is not None
        assert fetched["email"] == "alice@example.com"
        assert fetched["name"] == "Alice"
        assert set(fetched["topics"]) == {"news", "business"}

    def test_create_and_retrieve_by_email(self):
        create_user("bob@example.com", "Bob", ["politics"])
        fetched = get_user_by_email("BOB@EXAMPLE.COM")  # case-insensitive
        assert fetched is not None
        assert fetched["name"] == "Bob"

    def test_new_user_not_confirmed(self):
        user = create_user("carol@example.com", "Carol", ["marketing"])
        assert user["confirmed"] is False

    def test_confirm_user(self):
        user = create_user("dave@example.com", "Dave", ["news"])
        confirm_user(user["id"])
        confirmed = get_user_by_id(user["id"])
        assert confirmed["confirmed"] is True

    def test_update_preferences_topics(self):
        user = create_user("eve@example.com", "Eve", ["news"])
        update_preferences(user["id"], topics=["business", "celebrity"])
        updated = get_user_by_id(user["id"])
        assert set(updated["topics"]) == {"business", "celebrity"}

    def test_update_preferences_name(self):
        user = create_user("frank@example.com", "Frank", ["news"])
        update_preferences(user["id"], name="Franklin")
        updated = get_user_by_id(user["id"])
        assert updated["name"] == "Franklin"

    def test_deactivate_user(self):
        user = create_user("grace@example.com", "Grace", ["news"])
        confirm_user(user["id"])
        deactivate_user(user["id"])
        deactivated = get_user_by_id(user["id"])
        assert deactivated["active"] is False

    def test_get_all_active_returns_only_confirmed_active(self):
        u1 = create_user("h@example.com", "H", ["news"])
        confirm_user(u1["id"])
        u2 = create_user("i@example.com", "I", ["news"])  # unconfirmed
        u3 = create_user("j@example.com", "J", ["news"])
        confirm_user(u3["id"])
        deactivate_user(u3["id"])  # inactive

        active = get_all_active_users()
        emails = [u["email"] for u in active]
        assert "h@example.com" in emails
        assert "i@example.com" not in emails
        assert "j@example.com" not in emails

    def test_get_user_by_id_nonexistent_returns_none(self):
        assert get_user_by_id("nonexistent-id") is None

    def test_get_user_by_email_nonexistent_returns_none(self):
        assert get_user_by_email("nobody@example.com") is None


class TestDeliveryLog:
    def test_log_and_stats(self):
        user = create_user("k@example.com", "K", ["news"])
        log_delivery(user["id"], success=True)
        log_delivery(user["id"], success=True)
        log_delivery(user["id"], success=False, message="bounce")

        stats = get_delivery_stats()
        assert stats["total"] == 3
        assert stats["successful"] == 2
        assert stats["failed"] == 1
        assert stats["success_rate"] == pytest.approx(66.67, abs=0.01)
