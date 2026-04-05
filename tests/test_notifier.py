"""
Unit tests for src/notifier/whatsapp.py
Twilio client is mocked — no real API calls.
"""
from __future__ import annotations

import pytest
from unittest.mock import MagicMock, patch

from src.notifier.whatsapp import (
    send_whatsapp_instant,
    send_whatsapp_digest,
    _format_instant_message,
    _format_digest_message,
    _MAX_MSG_CHARS,
    _MAX_DIGEST_ITEMS,
)
from src.email_builder.sender import DeliveryResult


# ── Test fixtures ─────────────────────────────────────────────────────────────

def _listing(**kwargs) -> dict:
    defaults = {
        "listing_id": "abc123",
        "url": "https://www.beyondretro.com/products/jacket",
        "title": "1970s Brown Suede Fringe Jacket",
        "source_slug": "beyond_retro",
        "source_name": "Beyond Retro",
        "price_gbp": 48.0,
        "shipping_gbp": 4.5,
        "total_gbp": 52.5,
        "size": "UK 12",
        "condition": "Excellent",
        "image_url": "https://cdn.beyondretro.com/jacket.jpg",
        "verdict": "Great Value",
        "verdict_pct": 22,
    }
    defaults.update(kwargs)
    return defaults


# ── Dry-run path (no Twilio credentials) ─────────────────────────────────────

class TestDryRun:
    def test_instant_dry_run_returns_success(self, monkeypatch):
        monkeypatch.setattr("config.settings.TWILIO_ACCOUNT_SID", "")
        result = send_whatsapp_instant("+447700900000", _listing(), "Test Search")
        assert result.success is True
        assert result.message == "dry-run"

    def test_digest_dry_run_returns_success(self, monkeypatch):
        monkeypatch.setattr("config.settings.TWILIO_ACCOUNT_SID", "")
        result = send_whatsapp_digest("+447700900000", [_listing()], "Test Search")
        assert result.success is True
        assert result.message == "dry-run"


# ── Instant message formatting ────────────────────────────────────────────────

class TestInstantMessageFormat:
    def test_contains_title(self):
        msg = _format_instant_message(_listing(), "My Search", "")
        assert "1970s Brown Suede Fringe Jacket" in msg

    def test_contains_source_name(self):
        msg = _format_instant_message(_listing(), "My Search", "")
        assert "Beyond Retro" in msg

    def test_contains_total_price(self):
        msg = _format_instant_message(_listing(), "My Search", "")
        assert "52.50" in msg

    def test_contains_shipping_tbc_when_unknown(self):
        msg = _format_instant_message(
            _listing(shipping_gbp=None, total_gbp=None), "My Search", ""
        )
        assert "TBC" in msg

    def test_great_value_verdict_shown(self):
        msg = _format_instant_message(_listing(verdict="Great Value", verdict_pct=22), "My Search", "")
        assert "Great Value" in msg
        assert "22%" in msg

    def test_overpriced_verdict_shown(self):
        msg = _format_instant_message(_listing(verdict="Overpriced", verdict_pct=15), "My Search", "")
        assert "Overpriced" in msg

    def test_no_verdict_when_none(self):
        msg = _format_instant_message(_listing(verdict=None), "My Search", "")
        assert "Great Value" not in msg
        assert "Overpriced" not in msg

    def test_search_name_in_footer(self):
        msg = _format_instant_message(_listing(), "70s Suede Jacket Search", "")
        assert "70s Suede Jacket Search" in msg

    def test_manage_url_included_when_provided(self):
        msg = _format_instant_message(_listing(), "Test", "https://example.com/manage")
        assert "https://example.com/manage" in msg

    def test_title_truncated_at_120_chars(self):
        long_title = "A" * 200
        msg = _format_instant_message(_listing(title=long_title), "Test", "")
        # Title in message should be at most 120 chars
        assert long_title not in msg


# ── Digest message formatting ─────────────────────────────────────────────────

class TestDigestMessageFormat:
    def test_shows_correct_count(self):
        listings = [_listing(listing_id=str(i), url=f"https://example.com/{i}") for i in range(3)]
        msg = _format_digest_message(listings, "My Search", "", "")
        assert "3 new matches" in msg

    def test_singular_count(self):
        msg = _format_digest_message([_listing()], "My Search", "", "")
        assert "1 new match" in msg
        assert "matches" not in msg

    def test_max_10_items_in_body(self):
        listings = [
            _listing(listing_id=str(i), url=f"https://example.com/{i}", title=f"Item {i}")
            for i in range(15)
        ]
        msg = _format_digest_message(listings, "My Search", "", "https://app.com")
        # Only first 10 should appear as numbered items
        assert "10." in msg
        assert "11." not in msg

    def test_overflow_link_shown_when_more_than_10(self):
        listings = [
            _listing(listing_id=str(i), url=f"https://example.com/{i}")
            for i in range(12)
        ]
        msg = _format_digest_message(listings, "My Search", "", "https://app.com")
        assert "https://app.com" in msg
        assert "12 matches" in msg

    def test_no_overflow_link_for_under_10(self):
        listings = [_listing()]
        msg = _format_digest_message(listings, "My Search", "", "https://app.com")
        # app_url should not appear when ≤10 items
        assert "https://app.com" not in msg

    def test_message_never_exceeds_whatsapp_limit(self):
        # 20 very long listings
        listings = [
            _listing(
                listing_id=str(i),
                url=f"https://example.com/{'a' * 100}/{i}",
                title="A" * 120,
            )
            for i in range(20)
        ]
        msg = _format_digest_message(listings, "My Search", "", "https://app.com")
        assert len(msg) <= _MAX_MSG_CHARS

    def test_search_name_in_footer(self):
        msg = _format_digest_message([_listing()], "70s Suede Jacket", "", "")
        assert "70s Suede Jacket" in msg


# ── Twilio send path ──────────────────────────────────────────────────────────

class TestTwilioSend:
    def test_calls_twilio_create_with_correct_args(self, monkeypatch):
        monkeypatch.setattr("config.settings.TWILIO_ACCOUNT_SID", "ACtest")
        monkeypatch.setattr("config.settings.TWILIO_AUTH_TOKEN", "token")
        monkeypatch.setattr("config.settings.TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")

        mock_message = MagicMock()
        mock_message.sid = "SM123"
        mock_message.status = "queued"

        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_message

        import src.notifier.whatsapp as wa_module
        original_client = wa_module.Client
        wa_module.Client = lambda *a, **kw: mock_client
        try:
            result = send_whatsapp_instant("+447700900000", _listing(), "Test")
        finally:
            wa_module.Client = original_client

        assert result.success is True
        call_kwargs = mock_client.messages.create.call_args.kwargs
        assert call_kwargs["to"] == "whatsapp:+447700900000"
        assert call_kwargs["from_"] == "whatsapp:+14155238886"
        assert "1970s Brown Suede Fringe Jacket" in call_kwargs["body"]
        # Image should be included for instant alerts
        assert "media_url" in call_kwargs

    def test_twilio_error_returns_failure(self, monkeypatch):
        monkeypatch.setattr("config.settings.TWILIO_ACCOUNT_SID", "ACtest")
        monkeypatch.setattr("config.settings.TWILIO_AUTH_TOKEN", "token")
        monkeypatch.setattr("config.settings.TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")

        import src.notifier.whatsapp as wa_module
        original_client = wa_module.Client
        def _raise(*a, **kw):
            raise Exception("Twilio error")
        wa_module.Client = _raise
        try:
            result = send_whatsapp_instant("+447700900000", _listing(), "Test")
        finally:
            wa_module.Client = original_client

        assert result.success is False
        assert "Twilio error" in result.message

    def test_digest_sends_no_media(self, monkeypatch):
        monkeypatch.setattr("config.settings.TWILIO_ACCOUNT_SID", "ACtest")
        monkeypatch.setattr("config.settings.TWILIO_AUTH_TOKEN", "token")
        monkeypatch.setattr("config.settings.TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")

        mock_message = MagicMock(sid="SM456", status="queued")
        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_message

        import src.notifier.whatsapp as wa_module
        original_client = wa_module.Client
        wa_module.Client = lambda *a, **kw: mock_client
        try:
            send_whatsapp_digest("+447700900000", [_listing()], "Test")
        finally:
            wa_module.Client = original_client

        call_kwargs = mock_client.messages.create.call_args.kwargs
        assert "media_url" not in call_kwargs
