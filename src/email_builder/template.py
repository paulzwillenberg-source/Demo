"""
Email HTML builder.

Renders the Jinja2 email template with the personalized article data.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

from jinja2 import Environment, FileSystemLoader

_TOPIC_ICONS = {
    "news": "📰",
    "politics": "🏛️",
    "business": "💼",
    "marketing": "📣",
    "celebrity": "⭐",
}

_TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "templates")


def _get_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(_TEMPLATE_DIR),
        autoescape=True,
    )


def render_bulletin(
    user_name: str,
    topics: list[str],
    articles: dict[str, list[dict]],
    site_url: str = "https://yourdomain.com",
    preferences_url: str = "https://yourdomain.com/preferences",
    credentials_url: str = "https://yourdomain.com/credentials",
    unsubscribe_url: str = "https://yourdomain.com/unsubscribe",
) -> str:
    """Render the email HTML for a single subscriber."""
    now = datetime.now(tz=timezone.utc)
    env = _get_env()
    template = env.get_template("email_template.html")

    # Only include topics that have articles
    active_topics = [t for t in topics if articles.get(t)]

    html = template.render(
        greeting=f"Hi {user_name}" if user_name else "Hello",
        date=now.strftime("%A, %B %-d, %Y"),
        year=now.year,
        topics=active_topics,
        articles=articles,
        topic_icons=_TOPIC_ICONS,
        site_url=site_url,
        preferences_url=preferences_url,
        credentials_url=credentials_url,
        unsubscribe_url=unsubscribe_url,
    )
    return html


def render_vintage_instant(
    listing: dict,
    search_name: str = "My Search",
    manage_url: str = "https://yourdomain.com/vintage/preferences",
    unsubscribe_url: str = "https://yourdomain.com/unsubscribe",
) -> str:
    """Render a single-item instant alert email for a vintage listing."""
    now = datetime.now(tz=timezone.utc)
    env = _get_env()
    template = env.get_template("vintage/instant_alert.html")
    return template.render(
        title=listing.get("title", ""),
        source_name=listing.get("source_name", ""),
        image_url=listing.get("image_url"),
        listing_url=listing.get("url", ""),
        price_gbp=listing.get("price_gbp"),
        shipping_gbp=listing.get("shipping_gbp"),
        total_gbp=listing.get("total_gbp"),
        size=listing.get("size"),
        condition=listing.get("condition"),
        location=listing.get("location"),
        verdict=listing.get("verdict"),
        verdict_pct=listing.get("verdict_pct"),
        search_name=search_name,
        manage_url=manage_url,
        unsubscribe_url=unsubscribe_url,
        year=now.year,
    )


def render_vintage_instant_subject(listing: dict) -> str:
    """Generate a subject line for a single-item instant alert."""
    title = (listing.get("title") or "Vintage item")[:60]
    source = listing.get("source_name", "")
    total = listing.get("total_gbp") or listing.get("price_gbp")
    price_str = f" — £{total:.2f} total" if total else ""
    return f"🔍 New match: {title} on {source}{price_str}"


def render_vintage_digest(
    listings: list[dict],
    total_count: int,
    search_name: str = "My Search",
    app_url: str = "https://yourdomain.com",
    manage_url: str = "https://yourdomain.com/vintage/preferences",
    unsubscribe_url: str = "https://yourdomain.com/unsubscribe",
) -> str:
    """Render a multi-item digest email for vintage listings."""
    now = datetime.now(tz=timezone.utc)
    env = _get_env()
    template = env.get_template("vintage/digest.html")
    return template.render(
        listings=listings[:5],
        total_count=total_count,
        search_name=search_name,
        date=now.strftime("%A, %B %-d, %Y"),
        app_url=app_url,
        manage_url=manage_url,
        unsubscribe_url=unsubscribe_url,
        year=now.year,
    )


def render_vintage_digest_subject(total_count: int, search_name: str) -> str:
    """Generate a subject line for a digest email."""
    return f"🛍️ Your Vintage Scout Digest — {total_count} new match{'es' if total_count != 1 else ''} for '{search_name}'"


def render_subject(topics: list[str], date: str | None = None) -> str:
    """Generate a compelling email subject line."""
    if date is None:
        date = datetime.now(tz=timezone.utc).strftime("%A, %b %-d")
    topic_labels = " • ".join(t.title() for t in topics[:3])
    return f"Your Daily Bulletin – {date} | {topic_labels}"
