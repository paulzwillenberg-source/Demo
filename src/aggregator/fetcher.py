"""
News article fetcher.

Pulls articles from RSS feeds and the NewsAPI for each configured topic.
Returns a list of normalized Article dicts ready for the summarizer.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse

import requests

try:
    import feedparser as _feedparser
except ImportError:  # pragma: no cover
    _feedparser = None  # type: ignore[assignment]

from config import settings

logger = logging.getLogger(__name__)


@dataclass
class Article:
    title: str
    url: str
    topic: str
    source_name: str
    image_url: Optional[str] = None
    is_paywalled: bool = False
    raw_text: str = ""
    tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "url": self.url,
            "topic": self.topic,
            "source_name": self.source_name,
            "image_url": self.image_url,
            "is_paywalled": self.is_paywalled,
            "raw_text": self.raw_text,
            "tags": self.tags,
        }


def _source_name_from_url(url: str) -> str:
    """Derive a human-readable source name from the article URL."""
    try:
        host = urlparse(url).netloc.lstrip("www.")
        if not host:
            return "Unknown"
        return host.split(".")[0].title()
    except Exception:
        return "Unknown"


def _is_paywalled(url: str) -> bool:
    """Check whether an article URL belongs to a known paywalled source."""
    try:
        host = urlparse(url).netloc.lower()
        for slug in settings.PAYWALLED_SOURCES:
            if slug in host:
                return True
    except Exception:
        pass
    return False


def fetch_rss(topic: str, max_articles: int = settings.ARTICLES_PER_TOPIC) -> list[Article]:
    """Fetch articles for a topic from its configured RSS feeds."""
    if _feedparser is None:
        logger.warning("feedparser is not installed; RSS fetching unavailable.")
        return []

    feeds = settings.RSS_FEEDS.get(topic, [])
    articles: list[Article] = []

    for feed_url in feeds:
        if len(articles) >= max_articles:
            break
        try:
            parsed = _feedparser.parse(feed_url)
            for entry in parsed.entries:
                if len(articles) >= max_articles:
                    break
                url = entry.get("link", "")
                if not url:
                    continue
                title = entry.get("title", "").strip()
                raw_text = entry.get("summary", "").strip()

                # Attempt to extract an image from media content
                image_url = None
                for media in entry.get("media_content", []):
                    if media.get("type", "").startswith("image"):
                        image_url = media.get("url")
                        break
                if not image_url:
                    for enclosure in entry.get("enclosures", []):
                        if enclosure.get("type", "").startswith("image"):
                            image_url = enclosure.get("href") or enclosure.get("url")
                            break

                articles.append(
                    Article(
                        title=title,
                        url=url,
                        topic=topic,
                        source_name=_source_name_from_url(url),
                        image_url=image_url,
                        is_paywalled=_is_paywalled(url),
                        raw_text=raw_text,
                    )
                )
        except Exception as exc:
            logger.warning("Failed to parse RSS feed %s: %s", feed_url, exc)

    return articles


def fetch_newsapi(topic: str, max_articles: int = settings.ARTICLES_PER_TOPIC) -> list[Article]:
    """Fetch articles for a topic via NewsAPI (requires API key)."""
    if not settings.NEWS_API_KEY:
        return []

    query_map = {
        "news": "top headlines",
        "politics": "politics",
        "business": "business",
        "marketing": "marketing OR advertising",
        "celebrity": "celebrity OR entertainment",
    }
    query = query_map.get(topic, topic)

    try:
        resp = requests.get(
            f"{settings.NEWS_API_BASE}/everything",
            params={
                "q": query,
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": max_articles,
                "apiKey": settings.NEWS_API_KEY,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("NewsAPI request failed for topic '%s': %s", topic, exc)
        return []

    articles: list[Article] = []
    for item in data.get("articles", []):
        url = item.get("url", "")
        if not url:
            continue
        articles.append(
            Article(
                title=item.get("title", "").strip(),
                url=url,
                topic=topic,
                source_name=item.get("source", {}).get("name", _source_name_from_url(url)),
                image_url=item.get("urlToImage"),
                is_paywalled=_is_paywalled(url),
                raw_text=item.get("description") or item.get("content") or "",
            )
        )
    return articles


def fetch_articles_for_topics(topics: list[str]) -> dict[str, list[Article]]:
    """
    Fetch articles for all requested topics, de-duplicating by URL.

    Returns a dict mapping topic -> list[Article].
    """
    result: dict[str, list[Article]] = {}

    for topic in topics:
        seen_urls: set[str] = set()
        combined: list[Article] = []

        # Prefer NewsAPI when available; supplement/replace with RSS
        newsapi_articles = fetch_newsapi(topic)
        for a in newsapi_articles:
            if a.url not in seen_urls:
                seen_urls.add(a.url)
                combined.append(a)

        if len(combined) < settings.ARTICLES_PER_TOPIC:
            rss_articles = fetch_rss(topic, max_articles=settings.ARTICLES_PER_TOPIC - len(combined))
            for a in rss_articles:
                if a.url not in seen_urls:
                    seen_urls.add(a.url)
                    combined.append(a)

        result[topic] = combined[: settings.ARTICLES_PER_TOPIC]
        logger.info("Fetched %d article(s) for topic '%s'.", len(result[topic]), topic)

    return result
