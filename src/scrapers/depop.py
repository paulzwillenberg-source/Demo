"""
Depop scraper — Tier 3 (reverse-engineered internal API, high fragility).

Depop has no public API. This scraper uses Playwright to load the search
page in a headless browser and then extracts listings from the rendered DOM.
Depop's internal API endpoints change periodically — this scraper is designed
to FAIL LOUDLY rather than silently return empty results.

Prerequisites:
  pip install playwright
  playwright install chromium

Health monitoring: if this scraper returns zero results for >30 minutes,
an alert should surface in the UI. Build a health check alongside.

IMPORTANT: Depop's ToS permits personal use. Rate-limit aggressively (2-5s
between requests) and use rotating proxies in production.
"""
from __future__ import annotations

import logging
import time
from typing import Optional

from config import settings
from src.aggregator.fetcher import Listing
from src.scrapers.base import BaseScraper, ScraperError

logger = logging.getLogger(__name__)

_SITE_SLUG = "depop"
_SITE_NAME = "Depop"
_SEARCH_URL = "https://www.depop.com/search/"


class DepopScraper(BaseScraper):
    SITE_SLUG = _SITE_SLUG
    SITE_NAME = _SITE_NAME
    TIER = 3

    def scrape(self, keywords: list[str], filters: dict) -> list[Listing]:
        """
        Scrape Depop search results using Playwright.

        Raises ScraperError if Playwright is not installed or if scraping fails.
        """
        try:
            from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
        except ImportError:
            raise ScraperError(
                f"{self.SITE_SLUG}: Playwright is not installed. "
                "Run: pip install playwright && playwright install chromium"
            )

        query = " ".join(keywords).strip()
        if not query:
            raise ScraperError(f"{self.SITE_SLUG}: no keywords provided")

        listings: list[Listing] = []

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
                proxy={"server": settings.PROXY_URL} if settings.PROXY_URL else None,
            )
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/20A362"
                ),
                viewport={"width": 390, "height": 844},
            )
            page = context.new_page()

            try:
                url = f"{_SEARCH_URL}?q={query.replace(' ', '+')}&itemsPerPage=24"
                logger.debug("%s: navigating to %s", self.SITE_SLUG, url)
                page.goto(url, wait_until="domcontentloaded", timeout=30000)

                # Accept cookies if prompted
                try:
                    page.click("button[data-testid='cookieBanner__acceptBtn']", timeout=5000)
                    logger.debug("%s: accepted cookie banner", self.SITE_SLUG)
                except PlaywrightTimeout:
                    pass  # No banner — fine

                # Wait for product grid
                try:
                    page.wait_for_selector("[data-testid='productCard']", timeout=15000)
                except PlaywrightTimeout:
                    raise ScraperError(
                        f"{self.SITE_SLUG}: product grid selector not found after 15s. "
                        "Depop markup may have changed."
                    )

                # Scroll to load more results
                for _ in range(2):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    time.sleep(1.5)

                # Extract listings
                cards = page.query_selector_all("[data-testid='productCard']")
                if not cards:
                    raise ScraperError(
                        f"{self.SITE_SLUG}: zero product cards found. "
                        "Markup or test ID may have changed."
                    )

                for card in cards:
                    try:
                        listing = self._parse_card(page, card)
                        if listing:
                            listings.append(listing)
                    except Exception as exc:
                        logger.debug("%s: skipping card: %s", self.SITE_SLUG, exc)

            finally:
                browser.close()

        if not listings:
            raise ScraperError(
                f"{self.SITE_SLUG}: scraped 0 listings for query {query!r}. "
                "This scraper requires loud failure investigation."
            )

        logger.info("%s: scraped %d listings for %r", self.SITE_SLUG, len(listings), query)
        return self._apply_filters(listings, filters)

    def _parse_card(self, page, card) -> Optional[Listing]:
        # Title
        title_el = card.query_selector("[data-testid='productCard__description']")
        title = title_el.inner_text().strip() if title_el else None

        # URL
        link_el = card.query_selector("a[href]")
        if not link_el:
            return None
        href = link_el.get_attribute("href") or ""
        url = href if href.startswith("http") else f"https://www.depop.com{href}"
        if not title:
            title = url  # Fallback

        # Price
        price_el = card.query_selector("[data-testid='productCard__price']")
        price_gbp = self._parse_price(price_el.inner_text()) if price_el else None

        # Image
        img_el = card.query_selector("img")
        image_url: Optional[str] = img_el.get_attribute("src") if img_el else None

        # Size
        size_el = card.query_selector("[data-testid='productCard__size']")
        size = size_el.inner_text().strip() if size_el else None

        return Listing(
            listing_id=self._make_listing_id(self.SITE_SLUG, url),
            url=url,
            title=(title or "Depop listing")[:200],
            source_slug=self.SITE_SLUG,
            source_name=self.SITE_NAME,
            price_gbp=price_gbp,
            shipping_gbp=None,
            size=size,
            image_url=image_url,
            raw_description=title or "",
        )

    @staticmethod
    def _apply_filters(listings: list[Listing], filters: dict) -> list[Listing]:
        result = []
        for l in listings:
            if filters.get("price_max") and l.price_gbp and l.price_gbp > filters["price_max"]:
                continue
            if filters.get("price_min") and l.price_gbp and l.price_gbp < filters["price_min"]:
                continue
            result.append(l)
        return result
