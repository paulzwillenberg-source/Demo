"""
Podcast fetcher: search iTunes, parse RSS feeds, and resolve direct audio URLs.
"""
from __future__ import annotations

import re
import requests
import feedparser

ITUNES_SEARCH_URL = "https://itunes.apple.com/search"


def search_podcasts(query: str, limit: int = 10) -> list[dict]:
    """Search iTunes for podcasts matching query."""
    resp = requests.get(
        ITUNES_SEARCH_URL,
        params={"term": query, "media": "podcast", "limit": limit},
        timeout=10,
    )
    resp.raise_for_status()
    results = []
    for item in resp.json().get("results", []):
        results.append({
            "id": item.get("collectionId"),
            "title": item.get("collectionName", ""),
            "author": item.get("artistName", ""),
            "artwork": item.get("artworkUrl600") or item.get("artworkUrl100", ""),
            "feed_url": item.get("feedUrl", ""),
            "genre": item.get("primaryGenreName", ""),
            "episode_count": item.get("trackCount", 0),
        })
    return results


def parse_feed(feed_url: str) -> dict:
    """Parse an RSS feed and return podcast metadata and episode list."""
    feed = feedparser.parse(feed_url)

    podcast = {
        "title": feed.feed.get("title", ""),
        "author": feed.feed.get("author", ""),
        "description": feed.feed.get("description", ""),
        "image": feed.feed.get("image", {}).get("href", ""),
        "feed_url": feed_url,
    }

    episodes = []
    for entry in feed.entries[:50]:
        audio_url = None
        for enc in entry.get("enclosures", []):
            if enc.get("type", "").startswith("audio/"):
                audio_url = enc.get("href") or enc.get("url")
                break

        # Check Podcast 2.0 transcript namespace and link elements
        transcript_url = _find_transcript_url(entry)

        episodes.append({
            "id": entry.get("id", ""),
            "title": entry.get("title", "Unknown Episode"),
            "description": _strip_html(entry.get("summary", "")),
            "published": entry.get("published", ""),
            "duration": entry.get("itunes_duration", ""),
            "audio_url": audio_url,
            "transcript_url": transcript_url,
            "image": entry.get("image", {}).get("href", ""),
        })

    return {"podcast": podcast, "episodes": episodes}


def _find_transcript_url(entry) -> str | None:
    """Look for a transcript link in feed entry links and podcast namespace."""
    for link in entry.get("links", []):
        rel = link.get("rel", "")
        mime = link.get("type", "")
        if "transcript" in rel or mime in ("text/plain", "text/vtt", "application/srt", "application/json"):
            return link.get("href")

    # podcast:transcript namespace (parsed into tags by feedparser)
    for tag in entry.get("tags", []):
        if "transcript" in tag.get("term", "").lower():
            return tag.get("scheme")

    return None


def _strip_html(text: str) -> str:
    """Remove HTML tags from a string."""
    return re.sub(r"<[^>]+>", "", text).strip()
