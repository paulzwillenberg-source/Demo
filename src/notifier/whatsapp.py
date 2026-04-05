"""
WhatsApp notification sender via Twilio WhatsApp Business API.

Mirrors the interface of src/email_builder/sender.py:
- Returns DeliveryResult (imported, not duplicated)
- Has a dry-run path when TWILIO_ACCOUNT_SID is not configured

Alert formats (from wireframes):
  Instant — single item with title, price, size, condition, URL
  Digest  — numbered list of up to 10 items (WhatsApp 4096-char limit)

NOTE: Production use requires Meta WhatsApp Business Account approval
(3–7 business days). During development, use the Twilio Sandbox.
Message templates must be pre-approved by Meta for production sends.
"""
from __future__ import annotations

import logging
from typing import Optional

from config import settings
from src.email_builder.sender import DeliveryResult

try:
    from twilio.rest import Client  # type: ignore[import]
except ImportError:
    Client = None  # type: ignore[assignment,misc]

logger = logging.getLogger(__name__)

# WhatsApp hard limit per message
_MAX_MSG_CHARS = 4096
# Max items shown in a digest message body
_MAX_DIGEST_ITEMS = 10


def send_whatsapp_instant(
    to_number: str,
    listing: dict,
    search_name: str = "My Search",
    manage_url: str = "",
) -> DeliveryResult:
    """
    Send a single-item WhatsApp instant alert.

    Args:
        to_number:   Recipient's phone in E.164 format (e.g. "+447700900000")
        listing:     Listing.to_dict() output
        search_name: Name of the saved search that triggered the alert
        manage_url:  Link to manage alerts preferences
    """
    body = _format_instant_message(listing, search_name, manage_url)

    if not settings.TWILIO_ACCOUNT_SID:
        return _dry_run(to_number, body)

    media_url = listing.get("image_url") or None
    return _send_via_twilio(to_number, body, media_url=media_url)


def send_whatsapp_digest(
    to_number: str,
    listings: list[dict],
    search_name: str = "My Search",
    manage_url: str = "",
    app_url: str = "",
) -> DeliveryResult:
    """
    Send a multi-item WhatsApp digest alert.

    Per wireframes: text-only (no thumbnail), capped at 10 items.
    """
    body = _format_digest_message(listings, search_name, manage_url, app_url)

    if not settings.TWILIO_ACCOUNT_SID:
        return _dry_run(to_number, body)

    return _send_via_twilio(to_number, body, media_url=None)


# ── Message formatters ────────────────────────────────────────────────────────

def _format_instant_message(listing: dict, search_name: str, manage_url: str) -> str:
    title = (listing.get("title") or "Vintage item")[:120]
    source_name = listing.get("source_name", "")
    size = listing.get("size")
    condition = listing.get("condition")
    price_gbp = listing.get("price_gbp")
    shipping_gbp = listing.get("shipping_gbp")
    total_gbp = listing.get("total_gbp")
    url = listing.get("url", "")
    verdict = listing.get("verdict")
    verdict_pct = listing.get("verdict_pct")

    # Price line per wireframes
    if total_gbp:
        price_line = f"💰 £{price_gbp:.2f} + £{shipping_gbp:.2f} shipping = *£{total_gbp:.2f} total*"
    elif price_gbp:
        price_line = f"💰 £{price_gbp:.2f} + Shipping: TBC"
    else:
        price_line = "💰 Price unlisted"

    # Verdict line
    verdict_line = ""
    if verdict == "Great Value":
        pct_str = f" — priced {verdict_pct}% below similar sold items" if verdict_pct else ""
        verdict_line = f"✅ *Great Value*{pct_str}\n"
    elif verdict == "Overpriced":
        pct_str = f" — priced {verdict_pct}% above similar sold items" if verdict_pct else ""
        verdict_line = f"🔴 *Overpriced*{pct_str}\n"
    elif verdict == "Fair":
        verdict_line = "⚪ *Fair Value*\n"

    lines = [
        "🔍 *Vintage Scout Match Found*",
        "",
        f"📦 Found on: {source_name}",
        f"*{title}*",
    ]
    if size or condition:
        sub = " · ".join(filter(None, [size, condition]))
        lines.append(sub)
    lines += [
        price_line,
        verdict_line.rstrip() if verdict_line else None,
        f"👉 View on {source_name}: {url}",
        "---",
        f"_Alert for: {search_name}_",
    ]
    if manage_url:
        lines.append(f"_Manage your alerts: {manage_url}_")

    return "\n".join(l for l in lines if l is not None)


def _format_digest_message(
    listings: list[dict],
    search_name: str,
    manage_url: str,
    app_url: str,
) -> str:
    visible = listings[:_MAX_DIGEST_ITEMS]
    total = len(listings)

    lines = [
        "🛍️ *Your Vintage Scout Daily Digest*",
        f"_{total} new match{'es' if total != 1 else ''} since your last alert_",
        "",
    ]

    for i, item in enumerate(visible, 1):
        title = (item.get("title") or "Vintage item")[:80]
        source = item.get("source_name", "")
        size = item.get("size")
        total_gbp = item.get("total_gbp")
        price_gbp = item.get("price_gbp")
        verdict = item.get("verdict")
        url = item.get("url", "")

        price_str = f"£{total_gbp:.2f} inc. shipping" if total_gbp else (f"£{price_gbp:.2f}" if price_gbp else "Price TBC")
        verdict_str = {"Great Value": " · ✅ Great Value", "Overpriced": " · 🔴 Overpriced", "Fair": " · ⚪ Fair"}.get(verdict or "", "")
        size_str = f"Size {size} · " if size else ""

        lines.append(f"*{i}. {title}* — {source}")
        lines.append(f"{size_str}{price_str}{verdict_str}")
        lines.append(f"👉 {url}")
        lines.append("")

    if total > _MAX_DIGEST_ITEMS and app_url:
        lines.append(f"👉 _See all {total} matches on Vintage Scout: {app_url}_")
        lines.append("")

    lines += [
        "---",
        f"_Alert for: {search_name}",
        (f" · Manage alerts: {manage_url}_" if manage_url else "_"),
    ]

    msg = "\n".join(lines)
    # Hard truncation safety net (should not normally be hit)
    if len(msg) > _MAX_MSG_CHARS:
        msg = msg[:_MAX_MSG_CHARS - 3] + "..."
    return msg


# ── Twilio send ───────────────────────────────────────────────────────────────

def _send_via_twilio(
    to_number: str,
    body: str,
    media_url: Optional[str] = None,
) -> DeliveryResult:
    try:
        if Client is None:
            raise ImportError("twilio package not installed")
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        kwargs: dict = {
            "from_": settings.TWILIO_WHATSAPP_FROM,
            "to": f"whatsapp:{to_number}",
            "body": body,
        }
        if media_url:
            kwargs["media_url"] = [media_url]

        message = client.messages.create(**kwargs)
        logger.info(
            "WhatsApp sent to %s via Twilio (sid=%s status=%s).",
            to_number, message.sid, message.status,
        )
        return DeliveryResult(success=True, message=message.sid)

    except Exception as exc:
        logger.error("Twilio WhatsApp send failed to %s: %s", to_number, exc)
        return DeliveryResult(success=False, message=str(exc))


def _dry_run(to_number: str, body: str) -> DeliveryResult:
    """Log the message instead of sending (dev mode — no Twilio credentials)."""
    logger.info(
        "[DRY RUN] Would send WhatsApp to=%s body=\n%s",
        to_number,
        body[:500] + ("..." if len(body) > 500 else ""),
    )
    return DeliveryResult(success=True, message="dry-run", status_code=0)
