"""
Daily podcast job.

Checks configured RSS feeds for new episodes, transcribes and summarizes them,
then sends a digest email via SendGrid.
"""
from __future__ import annotations

import logging

from config import settings
from src.podcast.watcher import check_feeds
from src.podcast.email_builder import render_podcast_digest
from src.email_builder.sender import send_bulletin

logger = logging.getLogger(__name__)


def run_podcast_job(dry_run: bool = False) -> dict:
    """
    Execute the full podcast pipeline.

    Returns a summary dict with keys: checked_feeds, new_episodes, sent.
    """
    logger.info("Podcast job starting (dry_run=%s).", dry_run)

    if not settings.PODCAST_FEEDS:
        logger.warning("PODCAST_FEEDS is empty — nothing to do. Add feed URLs to .env.")
        return {"checked_feeds": 0, "new_episodes": 0, "sent": False}

    if not settings.PODCAST_EMAIL:
        logger.warning("PODCAST_EMAIL is not set — summaries will be generated but not sent.")

    episodes = check_feeds(progress=lambda msg: logger.info("  %s", msg))

    if not episodes:
        logger.info("No new episodes found.")
        return {
            "checked_feeds": len(settings.PODCAST_FEEDS),
            "new_episodes": 0,
            "sent": False,
        }

    logger.info("%d new episode(s) found.", len(episodes))
    subject, html = render_podcast_digest(episodes)

    if dry_run:
        logger.info("[DRY RUN] Would send: %s", subject)
        return {
            "checked_feeds": len(settings.PODCAST_FEEDS),
            "new_episodes": len(episodes),
            "sent": False,
        }

    if settings.PODCAST_EMAIL:
        result = send_bulletin(
            to_email=settings.PODCAST_EMAIL,
            to_name="",
            subject=subject,
            html_body=html,
        )
        if result.success:
            logger.info("Podcast digest sent to %s.", settings.PODCAST_EMAIL)
        else:
            logger.error("Failed to send podcast digest: %s", result.message)
    else:
        logger.info("No PODCAST_EMAIL set; skipping send. Subject would be: %s", subject)

    return {
        "checked_feeds": len(settings.PODCAST_FEEDS),
        "new_episodes": len(episodes),
        "sent": bool(settings.PODCAST_EMAIL and not dry_run),
    }
