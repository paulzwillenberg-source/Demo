"""
Podcast watcher: check RSS feeds for new episodes, transcribe and summarize them.

Uses a local JSON file (PODCAST_SEEN_DB) to track episode IDs that have already
been processed, so each episode is only ever summarized once.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Callable

from config import settings
from src.podcast.fetcher import parse_feed
from src.podcast.transcriber import get_transcript
from src.podcast.summarizer import summarize_transcript

logger = logging.getLogger(__name__)


def check_feeds(
    feeds: list[str] | None = None,
    progress: Callable[[str], None] | None = None,
) -> list[dict]:
    """
    Check each RSS feed for episodes that haven't been processed yet.

    Returns a list of result dicts, one per new episode:
      {podcast_title, episode_title, published, audio_url, summary, transcript}
    """
    feeds = feeds or settings.PODCAST_FEEDS
    if not feeds:
        logger.warning("No podcast feeds configured. Set PODCAST_FEEDS in .env")
        return []

    seen = _load_seen()
    results = []

    for feed_url in feeds:
        _emit(progress, f"Checking feed: {feed_url}")
        try:
            data = parse_feed(feed_url)
        except Exception as exc:
            logger.error("Failed to fetch feed %s: %s", feed_url, exc)
            continue

        podcast_title = data["podcast"].get("title", feed_url)
        feed_seen = seen.setdefault(feed_url, [])

        for episode in data["episodes"]:
            ep_id = episode.get("id") or episode.get("audio_url") or episode.get("title")
            if not ep_id or ep_id in feed_seen:
                continue

            audio_url = episode.get("audio_url", "")
            transcript_url = episode.get("transcript_url")
            ep_title = episode.get("title", "Unknown Episode")

            if not audio_url and not transcript_url:
                logger.info("Skipping '%s' — no audio or transcript URL.", ep_title)
                feed_seen.append(ep_id)
                continue

            _emit(progress, f"New episode: {ep_title}")
            try:
                transcript = get_transcript(
                    audio_url=audio_url,
                    transcript_url=transcript_url,
                    progress=progress,
                )
                summary = summarize_transcript(
                    transcript=transcript,
                    episode_title=ep_title,
                    podcast_title=podcast_title,
                    progress=progress,
                )
                results.append({
                    "podcast_title": podcast_title,
                    "episode_title": ep_title,
                    "published": episode.get("published", ""),
                    "audio_url": audio_url,
                    "summary": summary,
                    "transcript": transcript,
                })
                feed_seen.append(ep_id)
                _save_seen(seen)
                _emit(progress, f"Done: {ep_title}")
            except Exception as exc:
                logger.error("Failed to process episode '%s': %s", ep_title, exc)

    _save_seen(seen)
    return results


# ── Seen-episodes store ────────────────────────────────────────────────────────

def _load_seen() -> dict:
    if os.path.exists(settings.PODCAST_SEEN_DB):
        try:
            with open(settings.PODCAST_SEEN_DB) as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _save_seen(seen: dict) -> None:
    with open(settings.PODCAST_SEEN_DB, "w") as f:
        json.dump(seen, f, indent=2)


def _emit(fn: Callable | None, msg: str) -> None:
    if fn:
        fn(msg)
    logger.info(msg)
