"""
Beyond Retro scraper — Tier 1 (static HTML, low anti-scraping risk).

Beyond Retro is a UK vintage clothing retailer with a straightforward HTML
product listing page. Suitable as the first scraper to build and validate
the full pipeline.
"""
from __future__ import annotations

import logging
from typing import Optional

from bs4 import BeautifulSoup

from config import settings
from src.aggregator.fetcher import Listing
from src.scrapers.base import BaseScraper, ScraperError

logger = logging.getLogger(__name__)

_BASE_URL = "https://www.beyondretro.com/collections/all"
_SITE_SLUG = "beyond_retro"
_SITE_NAME = "Beyond Retro"


class BeyondRetroScraper(BaseScraper):
    SITE_SLUG = _SITE_SLUG
    SITE_NAME = _SITE_NAME
    TIER = 1

    def scrape(self, keywords: list[str], filters: dict) -> list[Listing]:
        """
        Scrape Beyond Retro for listings matching the given keywords.

        Raises ScraperError on failure — never returns empty list silently.
        """
        query = " ".join(keywords).strip()
        if not query:
            raise ScraperError(f"{self.SITE_SLUG}: no keywords provided")

        listings: list[Listing] = []
        max_pages = settings.SCRAPE_MAX_PAGES

        for page in range(1, max_pages + 1):
            params = {"q": query, "page": page}
            url = "https://www.beyondretro.com/collections/all"

            logger.debug("%s: fetching page %d (q=%r)", self.SITE_SLUG, page, query)
            resp = self._get_with_backoff(url, params=params)
            soup = BeautifulSoup(resp.text, "lxml")

            page_listings = self._parse_product_grid(soup)
            if not page_listings:
                logger.debug("%s: no products on page %d, stopping pagination.", self.SITE_SLUG, page)
                break

            listings.extend(page_listings)
            logger.info("%s: page %d → %d listings (total so far: %d)", self.SITE_SLUG, page, len(page_listings), len(listings))

            if page < max_pages:
                self._sleep()

        if not listings:
            # Loud failure — don't silently swallow an empty result
            raise ScraperError(
                f"{self.SITE_SLUG}: zero listings returned for query {query!r}. "
                "Markup may have changed."
            )

        # Apply filters post-scrape
        listings = self._apply_filters(listings, filters)
        return listings

    # ── Private helpers ───────────────────────────────────────────────────────

    def _parse_product_grid(self, soup: BeautifulSoup) -> list[Listing]:
        """Extract Listing objects from a Beyond Retro product grid page."""
        products = (
            soup.select("div.product-item")
            or soup.select("li.product-item")
            or soup.select("[data-product-id]")
            or soup.select(".grid__item")
        )

        listings: list[Listing] = []
        for product in products:
            try:
                listing = self._parse_product_card(product)
                if listing:
                    listings.append(listing)
            except Exception as exc:
                logger.debug("%s: skipping malformed product card: %s", self.SITE_SLUG, exc)

        return listings

    def _parse_product_card(self, card) -> Optional[Listing]:
        # Title
        title_el = (
            card.select_one(".product-item__title")
            or card.select_one(".product-card__title")
            or card.select_one("h2")
            or card.select_one("h3")
        )
        title = title_el.get_text(strip=True) if title_el else None
        if not title:
            return None

        # URL
        link_el = card.select_one("a[href]")
        if not link_el:
            return None
        href = link_el["href"]
        url = href if href.startswith("http") else f"https://www.beyondretro.com{href}"

        # Price
        price_el = (
            card.select_one(".price__regular .price-item--regular")
            or card.select_one(".price")
            or card.select_one("[class*='price']")
        )
        price_gbp = self._parse_price(price_el.get_text(strip=True)) if price_el else None

        # Image
        img_el = card.select_one("img[src]") or card.select_one("img[data-src]")
        image_url: Optional[str] = None
        if img_el:
            src = img_el.get("src") or img_el.get("data-src") or ""
            image_url = src if src.startswith("http") else (f"https:{src}" if src.startswith("//") else None)

        # Size (often in title or variant label)
        size = self._extract_size_from_title(title)

        return Listing(
            listing_id=self._make_listing_id(self.SITE_SLUG, url),
            url=url,
            title=title[:200],
            source_slug=self.SITE_SLUG,
            source_name=self.SITE_NAME,
            price_gbp=price_gbp,
            shipping_gbp=None,  # Beyond Retro doesn't show shipping on listing cards
            size=size,
            image_url=image_url,
            raw_description=title,
            location="London, UK",
        )

    @staticmethod
    def _extract_size_from_title(title: str) -> Optional[str]:
        """Attempt to extract a size token from the listing title."""
        import re
        # Match patterns like "Size 12", "UK 10", "M", "XL", "S/M"
        patterns = [
            r"\b(?:size\s*)?(?:UK\s*)?(\d{1,2})\b",
            r"\b(XXS|XS|S|M|L|XL|XXL|XXXL)\b",
        ]
        for pattern in patterns:
            m = re.search(pattern, title, re.IGNORECASE)
            if m:
                return m.group(0).strip()
        return None

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
