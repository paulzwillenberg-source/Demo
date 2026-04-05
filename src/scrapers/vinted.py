"""
Vinted scraper — Tier 3 (reverse-engineered endpoints, high fragility).

Vinted has no public API. Uses Playwright to handle JS rendering and the
cookie consent modal that appears on first load in the UK/EU.

Same requirements as Depop:
  pip install playwright
  playwright install chromium

IMPORTANT: Vinted's internal endpoints change. Build loud failure logging
from day one. Monitor for zero-result returns.
"""
from __future__ import annotations

import logging
import time
from typing import Optional

from config import settings
from src.aggregator.fetcher import Listing
from src.scrapers.base import BaseScraper, ScraperError

logger = logging.getLogger(__name__)

_SITE_SLUG = "vinted"
_SITE_NAME = "Vinted"
_SEARCH_URL = "https://www.vinted.co.uk/catalog"


class VintedScraper(BaseScraper):
    SITE_SLUG = _SITE_SLUG
    SITE_NAME = _SITE_NAME
    TIER = 3

    def scrape(self, keywords: list[str], filters: dict) -> list[Listing]:
        """
        Scrape Vinted search using Playwright.
        Raises ScraperError on failure — never silently returns [].
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
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                locale="en-GB",
            )
            page = context.new_page()

            try:
                url = f"{_SEARCH_URL}?search_text={query.replace(' ', '+')}"
                if filters.get("price_min"):
                    url += f"&price_from={filters['price_min']}"
                if filters.get("price_max"):
                    url += f"&price_to={filters['price_max']}"

                logger.debug("%s: navigating to %s", self.SITE_SLUG, url)
                page.goto(url, wait_until="domcontentloaded", timeout=30000)

                # Dismiss GDPR/cookie consent modal (Vinted UK always shows this)
                _cookie_selectors = [
                    "button[data-testid='gdpr-consent-accept-button']",
                    "#onetrust-accept-btn-handler",
                    "button:has-text('Accept all')",
                    "button:has-text('I Accept')",
                ]
                for selector in _cookie_selectors:
                    try:
                        page.click(selector, timeout=4000)
                        logger.debug("%s: dismissed cookie banner via %r", self.SITE_SLUG, selector)
                        break
                    except PlaywrightTimeout:
                        continue

                # Wait for item grid
                _grid_selectors = [
                    "[data-testid='grid-item']",
                    ".feed-grid__item",
                    "[class*='ItemBox']",
                ]
                grid_found = False
                for selector in _grid_selectors:
                    try:
                        page.wait_for_selector(selector, timeout=12000)
                        grid_found = True
                        logger.debug("%s: grid found via selector %r", self.SITE_SLUG, selector)
                        break
                    except PlaywrightTimeout:
                        continue

                if not grid_found:
                    raise ScraperError(
                        f"{self.SITE_SLUG}: no item grid found after 12s. "
                        "Vinted markup may have changed."
                    )

                # Scroll to load more
                for _ in range(2):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    time.sleep(1.5)

                # Try each grid selector
                cards = []
                for selector in _grid_selectors:
                    cards = page.query_selector_all(selector)
                    if cards:
                        break

                if not cards:
                    raise ScraperError(
                        f"{self.SITE_SLUG}: zero item cards extracted. "
                        "Selector may have changed."
                    )

                for card in cards:
                    try:
                        listing = self._parse_card(card)
                        if listing:
                            listings.append(listing)
                    except Exception as exc:
                        logger.debug("%s: skipping card: %s", self.SITE_SLUG, exc)

            finally:
                browser.close()

        if not listings:
            raise ScraperError(
                f"{self.SITE_SLUG}: scraped 0 listings for {query!r}. "
                "Loud failure — investigate selector changes."
            )

        logger.info("%s: scraped %d listings for %r", self.SITE_SLUG, len(listings), query)
        return listings

    def _parse_card(self, card) -> Optional[Listing]:
        link_el = card.query_selector("a[href]")
        if not link_el:
            return None
        href = link_el.get_attribute("href") or ""
        url = href if href.startswith("http") else f"https://www.vinted.co.uk{href}"

        title_el = (
            card.query_selector("[data-testid='description-title']")
            or card.query_selector("[class*='title']")
        )
        title = title_el.inner_text().strip() if title_el else None

        price_el = (
            card.query_selector("[data-testid='price']")
            or card.query_selector("[class*='price']")
        )
        price_gbp = self._parse_price(price_el.inner_text()) if price_el else None

        img_el = card.query_selector("img")
        image_url: Optional[str] = img_el.get_attribute("src") if img_el else None

        size_el = (
            card.query_selector("[data-testid='size-badge']")
            or card.query_selector("[class*='size']")
        )
        size = size_el.inner_text().strip() if size_el else None

        condition_el = card.query_selector("[data-testid='condition-badge']")
        condition = condition_el.inner_text().strip() if condition_el else None

        if not title:
            title = f"Vinted listing"

        return Listing(
            listing_id=self._make_listing_id(self.SITE_SLUG, url),
            url=url,
            title=title[:200],
            source_slug=self.SITE_SLUG,
            source_name=self.SITE_NAME,
            price_gbp=price_gbp,
            shipping_gbp=None,
            size=size,
            condition=condition,
            image_url=image_url,
            raw_description=title,
            location="UK",
        )
