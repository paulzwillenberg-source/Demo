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


def render_subject(topics: list[str], date: str | None = None) -> str:
    """Generate a compelling email subject line."""
    if date is None:
        date = datetime.now(tz=timezone.utc).strftime("%A, %b %-d")
    topic_labels = " • ".join(t.title() for t in topics[:3])
    return f"Your Daily Bulletin – {date} | {topic_labels}"
