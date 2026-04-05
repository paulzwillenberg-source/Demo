"""
BaseScraper — abstract base class for all Vintage Scout scrapers.

Every platform scraper must:
  - Set SITE_SLUG, SITE_NAME, TIER class constants
  - Implement scrape(keywords, filters) -> list[Listing]
  - Raise an exception on failure — NEVER silently return []
  - Use self._get_session() for all outbound requests (proxy-aware)
  - Respect per-platform rate limiting via self._sleep() / _backoff()
"""
from __future__ import annotations

import hashlib
import logging
import time
from abc import ABC, abstractmethod
from typing import Optional

import requests

from config import settings
from src.aggregator.fetcher import Listing

logger = logging.getLogger(__name__)

# Default delays between page requests (seconds)
_DEFAULT_PAGE_DELAY = 2.0
_MAX_BACKOFF = 64.0


class ScraperError(Exception):
    """Raised when a scraper cannot return valid results."""


class BaseScraper(ABC):
    SITE_SLUG: str = ""
    SITE_NAME: str = ""
    TIER: int = 1

    def __init__(self) -> None:
        self._session: Optional[requests.Session] = None

    # ── Public interface ──────────────────────────────────────────────────────

    @abstractmethod
    def scrape(self, keywords: list[str], filters: dict) -> list[Listing]:
        """
        Fetch listings matching the given keywords and filters.

        Must raise ScraperError (not return empty list) on failure.

        Args:
            keywords: Search terms to query
            filters: Dict with optional keys: size, price_min, price_max,
                     category, condition, location
        """

    # ── Shared helpers ────────────────────────────────────────────────────────

    def _get_session(self) -> requests.Session:
        """Return a requests.Session configured with proxy and headers."""
        if self._session is None:
            self._session = requests.Session()
            self._session.headers.update(
                {
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36"
                    ),
                    "Accept-Language": "en-GB,en;q=0.9",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                }
            )
            if settings.PROXY_URL:
                proxies = {"http": settings.PROXY_URL, "https": settings.PROXY_URL}
                self._session.proxies.update(proxies)
                logger.debug("%s: using proxy %s", self.SITE_SLUG, settings.PROXY_URL)
        return self._session

    @staticmethod
    def _make_listing_id(source_slug: str, url: str) -> str:
        return hashlib.sha256(f"{source_slug}:{url}".encode()).hexdigest()[:16]

    @staticmethod
    def _parse_price(text: str) -> Optional[float]:
        """Extract a float price from strings like '£48.00', '$120', '€35'."""
        import re
        if not text:
            return None
        cleaned = re.sub(r"[^\d.]", "", text.strip())
        try:
            return round(float(cleaned), 2)
        except (ValueError, TypeError):
            return None

    def _sleep(self, seconds: float = _DEFAULT_PAGE_DELAY) -> None:
        time.sleep(seconds)

    def _get_with_backoff(
        self,
        url: str,
        params: dict | None = None,
        max_retries: int = 4,
    ) -> requests.Response:
        """
        GET request with exponential backoff on 429/503 responses.
        Raises ScraperError if all retries are exhausted.
        """
        session = self._get_session()
        delay = 2.0
        for attempt in range(max_retries + 1):
            try:
                resp = session.get(url, params=params, timeout=15)
                if resp.status_code in (429, 503):
                    if attempt < max_retries:
                        logger.warning(
                            "%s: rate limited (HTTP %d), backing off %.0fs (attempt %d/%d)",
                            self.SITE_SLUG, resp.status_code, delay, attempt + 1, max_retries,
                        )
                        time.sleep(min(delay, _MAX_BACKOFF))
                        delay *= 2
                        continue
                    raise ScraperError(
                        f"{self.SITE_SLUG}: rate-limited after {max_retries} retries "
                        f"(HTTP {resp.status_code})"
                    )
                resp.raise_for_status()
                return resp
            except requests.RequestException as exc:
                if attempt < max_retries:
                    logger.warning(
                        "%s: request error '%s', retrying in %.0fs", self.SITE_SLUG, exc, delay
                    )
                    time.sleep(min(delay, _MAX_BACKOFF))
                    delay *= 2
                else:
                    raise ScraperError(
                        f"{self.SITE_SLUG}: request failed after {max_retries} retries: {exc}"
                    ) from exc
        raise ScraperError(f"{self.SITE_SLUG}: exhausted retries for {url}")
