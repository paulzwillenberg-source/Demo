"""
Vintage Scout scrape orchestrator.

Two entry points registered with APScheduler:

  run_vintage_scrape_job()  — runs on interval (every 15 min by default)
    1. Load all users with active vintage preferences
    2. Run each enabled scraper
    3. Deduplicate against seen store
    4. Enrich new listings via Claude parse_listing()
    5. Match against each user's saved preferences
    6. Dispatch instant alerts immediately
    7. Queue digest items for the digest job

  run_vintage_digest_job()  — runs daily (8am by default)
    1. Load all users with pending digest queue items
    2. Send digest email/WhatsApp
    3. Mark items as sent

Both jobs use the same per-user try/except isolation pattern from daily_job.py
so one bad user never aborts the full run.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

import anthropic

from config import settings
from src.aggregator.fetcher import Listing
from src.dedup.store import DedupStore
from src.email_builder import sender as email_sender
from src.email_builder.template import (
    render_vintage_instant,
    render_vintage_instant_subject,
    render_vintage_digest,
    render_vintage_digest_subject,
)
from src.matchers.preference_matcher import match_listings
from src.notifier.whatsapp import send_whatsapp_instant, send_whatsapp_digest
from src.preferences.manager import (
    get_all_vintage_users,
    get_vintage_preferences,
    get_pending_digest_items,
    log_vintage_alert,
    mark_digest_sent,
    queue_digest_item,
)
from src.scrapers import REGISTRY, get_scraper
from src.scrapers.base import ScraperError
from src.summarizer.summarizer import parse_listing

logger = logging.getLogger(__name__)

_APP_BASE_URL = "https://yourdomain.com"


def run_vintage_scrape_job(dry_run: bool = False) -> dict:
    """
    Main scrape-and-alert job. Returns summary stats dict.
    """
    stats = {"scraped": 0, "new": 0, "matched": 0, "alerted": 0, "errors": 0}

    users = get_all_vintage_users()
    if not users:
        logger.info("Vintage scrape job: no active users with vintage preferences.")
        return stats

    dedup = DedupStore()

    # Build a unified set of keywords from all users to minimise scraper calls
    all_keywords: set[str] = set()
    for user_prefs in users:
        all_keywords.update(user_prefs.get("keywords") or [])

    # If no user has set keywords, use a broad vintage catch-all
    if not all_keywords:
        all_keywords = {"vintage"}

    keywords = list(all_keywords)

    # Run enabled scrapers (intersection of global ENABLED_SCRAPERS and REGISTRY)
    enabled = [s for s in settings.ENABLED_SCRAPERS if s in REGISTRY]
    if not enabled:
        logger.warning("Vintage scrape job: no enabled scrapers in REGISTRY.")
        return stats

    all_listings: list[Listing] = []
    for slug in enabled:
        try:
            scraper = get_scraper(slug)
            listings = scraper.scrape(keywords=keywords, filters={})
            logger.info("Scraper %s returned %d listings.", slug, len(listings))
            stats["scraped"] += len(listings)
            all_listings.extend(listings)
        except ScraperError as exc:
            logger.error("Scraper %s FAILED: %s", slug, exc)
            stats["errors"] += 1
        except Exception as exc:
            logger.error("Unexpected error in scraper %s: %s", slug, exc, exc_info=True)
            stats["errors"] += 1

    if not all_listings:
        logger.info("No listings scraped this run.")
        return stats

    # Claude enrichment — one client for the whole job run
    claude_client: Optional[anthropic.Anthropic] = None
    if settings.ANTHROPIC_API_KEY:
        claude_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    enriched: list[Listing] = []
    for listing in all_listings:
        try:
            enriched.append(parse_listing(listing, client=claude_client))
        except Exception as exc:
            logger.warning("parse_listing failed for %s: %s", listing.listing_id, exc)
            enriched.append(listing)

    # Per-user matching and alerting
    for user_prefs in users:
        user_id = user_prefs["user_id"]
        try:
            _process_user(user_id, user_prefs, enriched, dedup, stats, dry_run)
        except Exception as exc:
            logger.error("Error processing user %s in vintage job: %s", user_id, exc, exc_info=True)
            stats["errors"] += 1

    logger.info(
        "Vintage scrape job complete: scraped=%d new=%d matched=%d alerted=%d errors=%d",
        stats["scraped"], stats["new"], stats["matched"], stats["alerted"], stats["errors"],
    )
    return stats


def _process_user(
    user_id: str,
    user_prefs: dict,
    all_listings: list[Listing],
    dedup: DedupStore,
    stats: dict,
    dry_run: bool,
) -> None:
    alert_format = user_prefs.get("alert_format", "email_digest")

    # Filter to unseen listings for this user
    new_listings = [
        l for l in all_listings if not dedup.is_seen(user_id, l.listing_id)
    ]
    stats["new"] += len(new_listings)

    # Match against this user's preferences
    matched = match_listings(new_listings, user_prefs)
    stats["matched"] += len(matched)

    if not matched:
        return

    for listing in matched:
        if not dry_run:
            dedup.mark_seen(user_id, listing.listing_id, listing.source_slug)

    if alert_format in ("email_instant", "whatsapp_instant"):
        for listing in matched:
            _send_instant_alert(user_id, user_prefs, listing, alert_format, dry_run)
            stats["alerted"] += 1
    else:
        # Queue for digest job
        for listing in matched:
            if not dry_run:
                queue_digest_item(user_id, json.dumps(listing.to_dict()))
            stats["alerted"] += 1
        logger.info("Queued %d items for digest for user %s.", len(matched), user_id)


def _send_instant_alert(
    user_id: str,
    user_prefs: dict,
    listing: Listing,
    alert_format: str,
    dry_run: bool,
) -> None:
    from src.preferences.manager import get_user_by_id

    user = get_user_by_id(user_id)
    if not user:
        return

    listing_dict = listing.to_dict()
    search_name = "Vintage Search"  # Could be stored per-prefs in future
    manage_url = f"{_APP_BASE_URL}/vintage/preferences/{user_id}"
    unsubscribe_url = f"{_APP_BASE_URL}/unsubscribe/{user_id}"

    if alert_format == "email_instant":
        html = render_vintage_instant(
            listing_dict,
            search_name=search_name,
            manage_url=manage_url,
            unsubscribe_url=unsubscribe_url,
        )
        subject = render_vintage_instant_subject(listing_dict)
        if not dry_run:
            result = email_sender.send_bulletin(
                to_email=user["email"],
                to_name=user.get("name", ""),
                subject=subject,
                html_body=html,
            )
        else:
            logger.info("[DRY RUN] Would send email instant alert to %s for listing %s", user["email"], listing.listing_id)
            result = email_sender.DeliveryResult(success=True, message="dry-run")

    else:  # whatsapp_instant
        whatsapp_number = user_prefs.get("whatsapp_number") or ""
        if not whatsapp_number:
            logger.warning("User %s has no WhatsApp number configured.", user_id)
            return
        if not dry_run:
            result = send_whatsapp_instant(
                whatsapp_number,
                listing_dict,
                search_name=search_name,
                manage_url=manage_url,
            )
        else:
            logger.info("[DRY RUN] Would send WhatsApp instant to %s for listing %s", whatsapp_number, listing.listing_id)
            result = email_sender.DeliveryResult(success=True, message="dry-run")

    log_vintage_alert(
        user_id=user_id,
        listing_id=listing.listing_id,
        alert_format=alert_format,
        success=result.success,
        message=result.message,
    )


# ── Digest job ────────────────────────────────────────────────────────────────

def run_vintage_digest_job(dry_run: bool = False) -> dict:
    """
    Flush pending digest queue items and send digest alerts to each user.
    """
    stats = {"users_processed": 0, "digests_sent": 0, "errors": 0}

    users = get_all_vintage_users()
    for user_prefs in users:
        user_id = user_prefs["user_id"]
        try:
            _send_user_digest(user_id, user_prefs, dry_run, stats)
        except Exception as exc:
            logger.error("Error sending digest for user %s: %s", user_id, exc, exc_info=True)
            stats["errors"] += 1

    logger.info(
        "Vintage digest job complete: users=%d digests_sent=%d errors=%d",
        stats["users_processed"], stats["digests_sent"], stats["errors"],
    )
    return stats


def _send_user_digest(user_id: str, user_prefs: dict, dry_run: bool, stats: dict) -> None:
    from src.preferences.manager import get_user_by_id

    raw_items = get_pending_digest_items(user_id)
    if not raw_items:
        return  # No items queued — per wireframes: don't send empty digests

    stats["users_processed"] += 1
    listings = [json.loads(j) for j in raw_items]
    total_count = len(listings)
    alert_format = user_prefs.get("alert_format", "email_digest")
    search_name = "Vintage Search"
    manage_url = f"{_APP_BASE_URL}/vintage/preferences/{user_id}"
    unsubscribe_url = f"{_APP_BASE_URL}/unsubscribe/{user_id}"

    if alert_format == "email_digest":
        user = get_user_by_id(user_id)
        if not user:
            return
        html = render_vintage_digest(
            listings=listings,
            total_count=total_count,
            search_name=search_name,
            app_url=f"{_APP_BASE_URL}/vintage/{user_id}",
            manage_url=manage_url,
            unsubscribe_url=unsubscribe_url,
        )
        subject = render_vintage_digest_subject(total_count, search_name)
        if not dry_run:
            result = email_sender.send_bulletin(
                to_email=user["email"],
                to_name=user.get("name", ""),
                subject=subject,
                html_body=html,
            )
            if result.success:
                mark_digest_sent(user_id)
        else:
            logger.info("[DRY RUN] Would send email digest to %s (%d items)", user["email"], total_count)
            result = email_sender.DeliveryResult(success=True, message="dry-run")

    elif alert_format == "whatsapp_digest":
        whatsapp_number = user_prefs.get("whatsapp_number") or ""
        if not whatsapp_number:
            logger.warning("User %s has no WhatsApp number for digest.", user_id)
            return
        if not dry_run:
            result = send_whatsapp_digest(
                whatsapp_number,
                listings,
                search_name=search_name,
                manage_url=manage_url,
                app_url=f"{_APP_BASE_URL}/vintage/{user_id}",
            )
            if result.success:
                mark_digest_sent(user_id)
        else:
            logger.info("[DRY RUN] Would send WhatsApp digest to %s (%d items)", whatsapp_number, total_count)
            result = email_sender.DeliveryResult(success=True, message="dry-run")
    else:
        return  # Non-digest format — nothing to do here

    log_vintage_alert(
        user_id=user_id,
        listing_id="digest",
        alert_format=alert_format,
        success=result.success,
        message=result.message,
    )
    stats["digests_sent"] += 1
