"""
Thrifted.com scraper — Tier 1 (static HTML, low anti-scraping risk).

Thrifted is a UK secondhand marketplace with straightforward HTML product
pages. Build second after Beyond Retro to validate that BaseScraper works
across different markup structures.
"""
from __future__ import annotations

import logging
from typing import Optional

from bs4 import BeautifulSoup

from config import settings
from src.aggregator.fetcher import Listing
from src.scrapers.base import BaseScraper, ScraperError

logger = logging.getLogger(__name__)

_SITE_SLUG = "thrifted"
_SITE_NAME = "Thrifted"
_SEARCH_URL = "https://thrifted.com/collections/all"


class ThriftedScraper(BaseScraper):
    SITE_SLUG = _SITE_SLUG
    SITE_NAME = _SITE_NAME
    TIER = 1

    def scrape(self, keywords: list[str], filters: dict) -> list[Listing]:
        query = " ".join(keywords).strip()
        if not query:
            raise ScraperError(f"{self.SITE_SLUG}: no keywords provided")

        listings: list[Listing] = []
        max_pages = settings.SCRAPE_MAX_PAGES

        for page in range(1, max_pages + 1):
            params = {"q": query, "page": page, "sort_by": "created-descending"}
            logger.debug("%s: fetching page %d (q=%r)", self.SITE_SLUG, page, query)
            resp = self._get_with_backoff(_SEARCH_URL, params=params)
            soup = BeautifulSoup(resp.text, "lxml")

            page_listings = self._parse_product_grid(soup)
            if not page_listings:
                logger.debug("%s: no products on page %d, stopping.", self.SITE_SLUG, page)
                break

            listings.extend(page_listings)
            logger.info(
                "%s: page %d → %d listings (total: %d)",
                self.SITE_SLUG, page, len(page_listings), len(listings),
            )
            if page < max_pages:
                self._sleep()

        if not listings:
            raise ScraperError(
                f"{self.SITE_SLUG}: zero listings returned for query {query!r}. "
                "Markup may have changed."
            )

        return self._apply_filters(listings, filters)

    # ── Private helpers ───────────────────────────────────────────────────────

    def _parse_product_grid(self, soup: BeautifulSoup) -> list[Listing]:
        products = (
            soup.select(".product-card")
            or soup.select(".product-item")
            or soup.select(".grid-item")
            or soup.select("[data-product-id]")
        )
        listings: list[Listing] = []
        for product in products:
            try:
                listing = self._parse_card(product)
                if listing:
                    listings.append(listing)
            except Exception as exc:
                logger.debug("%s: skipping card: %s", self.SITE_SLUG, exc)
        return listings

    def _parse_card(self, card) -> Optional[Listing]:
        # Title
        title_el = (
            card.select_one(".product-card__title")
            or card.select_one(".product-item__title")
            or card.select_one("h2, h3")
        )
        title = title_el.get_text(strip=True) if title_el else None
        if not title:
            return None

        # URL
        link_el = card.select_one("a[href]")
        if not link_el:
            return None
        href = link_el["href"]
        url = href if href.startswith("http") else f"https://thrifted.com{href}"

        # Price
        price_el = (
            card.select_one(".price__regular")
            or card.select_one(".price")
            or card.select_one("[class*='price']")
        )
        price_gbp = self._parse_price(price_el.get_text(strip=True)) if price_el else None

        # Image
        img_el = card.select_one("img[src], img[data-src]")
        image_url: Optional[str] = None
        if img_el:
            src = img_el.get("src") or img_el.get("data-src", "")
            image_url = src if src.startswith("http") else (f"https:{src}" if src.startswith("//") else None)

        # Condition badge
        condition_el = card.select_one(".condition-badge, [class*='condition']")
        condition = condition_el.get_text(strip=True) if condition_el else None

        return Listing(
            listing_id=self._make_listing_id(self.SITE_SLUG, url),
            url=url,
            title=title[:200],
            source_slug=self.SITE_SLUG,
            source_name=self.SITE_NAME,
            price_gbp=price_gbp,
            shipping_gbp=None,
            condition=condition,
            image_url=image_url,
            raw_description=title,
            location="UK",
        )

    @staticmethod
    def _apply_filters(listings: list[Listing], filters: dict) -> list[Listing]:
        result = []
        for listing in listings:
            if filters.get("price_max") and listing.price_gbp and listing.price_gbp > filters["price_max"]:
                continue
            if filters.get("price_min") and listing.price_gbp and listing.price_gbp < filters["price_min"]:
                continue
            result.append(listing)
        return result
