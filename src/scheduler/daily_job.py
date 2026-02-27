"""
Daily bulletin job.

This module implements the core orchestration logic that:
  1. Loads all active, confirmed subscribers from the database.
  2. Groups subscribers by their topic preferences to batch API calls.
  3. Fetches and summarizes articles for each unique topic set.
  4. Renders a personalized HTML email for every subscriber.
  5. Delivers the email and logs the result.

It can be invoked directly (python -m src.scheduler.daily_job) or via
APScheduler for automated daily delivery.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

import anthropic

from config import settings
from src.aggregator.fetcher import fetch_articles_for_topics
from src.email_builder.sender import send_bulletin
from src.email_builder.template import render_bulletin, render_subject
from src.preferences.manager import get_all_active_users, log_delivery
from src.summarizer.summarizer import summarize_articles

logger = logging.getLogger(__name__)


def _topic_key(topics: list[str]) -> str:
    """Create a stable cache key from a sorted topic list."""
    return "|".join(sorted(topics))


def run_daily_job(
    site_url: str = "https://yourdomain.com",
    dry_run: bool = False,
) -> dict:
    """
    Execute the full daily bulletin pipeline.

    Returns a summary dict with keys: total, sent, failed.
    """
    logger.info("Daily bulletin job starting (dry_run=%s).", dry_run)

    users = get_all_active_users()
    if not users:
        logger.info("No active subscribers found. Exiting.")
        return {"total": 0, "sent": 0, "failed": 0}

    # ── 1. Build a shared Anthropic client ──────────────────────────────────
    client: Optional[anthropic.Anthropic] = None
    if settings.ANTHROPIC_API_KEY:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    # ── 2. Cache article+summary data per unique topic set ──────────────────
    cache: dict[str, dict[str, list[dict]]] = {}

    def get_content(topics: list[str]) -> dict[str, list[dict]]:
        key = _topic_key(topics)
        if key not in cache:
            logger.info("Fetching articles for topic set: %s", topics)
            raw = fetch_articles_for_topics(topics)
            cache[key] = summarize_articles(raw, client=client)
        return cache[key]

    # ── 3. Send personalized bulletins ──────────────────────────────────────
    total = len(users)
    sent = 0
    failed = 0

    now_date = datetime.now(tz=timezone.utc).strftime("%A, %b %-d")

    for user in users:
        uid = user["id"]
        try:
            topics = user["topics"]
            if not topics:
                logger.warning("User %s has no topics, skipping.", uid)
                continue

            articles = get_content(topics)
            html = render_bulletin(
                user_name=user.get("name", ""),
                topics=topics,
                articles=articles,
                site_url=site_url,
                preferences_url=f"{site_url}/preferences/{uid}",
                credentials_url=f"{site_url}/credentials/{uid}",
                unsubscribe_url=f"{site_url}/unsubscribe/{uid}",
            )
            subject = render_subject(topics, date=now_date)

            if dry_run:
                logger.info("[DRY RUN] Would send to %s (uid=%s).", user["email"], uid)
                log_delivery(uid, success=True, message="dry-run")
                sent += 1
            else:
                result = send_bulletin(
                    to_email=user["email"],
                    to_name=user.get("name", ""),
                    subject=subject,
                    html_body=html,
                )
                log_delivery(uid, success=result.success, message=result.message)
                if result.success:
                    sent += 1
                else:
                    failed += 1
                    logger.warning("Failed to send to %s: %s", user["email"], result.message)
        except Exception as exc:
            failed += 1
            logger.error("Unexpected error processing user %s: %s", uid, exc, exc_info=True)
            log_delivery(uid, success=False, message=str(exc))

    summary = {"total": total, "sent": sent, "failed": failed}
    logger.info("Daily bulletin job complete: %s", summary)
    return summary
