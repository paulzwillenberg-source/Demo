"""
ASOS Marketplace scraper — Tier 2 (semi-stable HTML).

ASOS Marketplace is a separate vintage/independent seller platform.
HTML structure is reasonably stable; pagination by page number.
Medium anti-scraping risk — add 1s delay between pages.
"""
from __future__ import annotations

import logging
from typing import Optional

from bs4 import BeautifulSoup

from config import settings
from src.aggregator.fetcher import Listing
from src.scrapers.base import BaseScraper, ScraperError

logger = logging.getLogger(__name__)

_SITE_SLUG = "asos_marketplace"
_SITE_NAME = "ASOS Marketplace"
_SEARCH_URL = "https://marketplace.asos.com/search"


class ASOSMarketplaceScraper(BaseScraper):
    SITE_SLUG = _SITE_SLUG
    SITE_NAME = _SITE_NAME
    TIER = 2

    def scrape(self, keywords: list[str], filters: dict) -> list[Listing]:
        query = " ".join(keywords).strip()
        if not query:
            raise ScraperError(f"{self.SITE_SLUG}: no keywords provided")

        listings: list[Listing] = []
        max_pages = settings.SCRAPE_MAX_PAGES

        for page in range(1, max_pages + 1):
            params = {"q": query, "page": page}
            logger.debug("%s: fetching page %d (q=%r)", self.SITE_SLUG, page, query)
            resp = self._get_with_backoff(_SEARCH_URL, params=params)
            soup = BeautifulSoup(resp.text, "lxml")

            page_listings = self._parse_grid(soup)
            if not page_listings:
                break

            listings.extend(page_listings)
            logger.info("%s: page %d → %d listings (total: %d)", self.SITE_SLUG, page, len(page_listings), len(listings))
            if page < max_pages:
                self._sleep(1.5)

        if not listings:
            raise ScraperError(
                f"{self.SITE_SLUG}: zero listings for query {query!r}. Markup may have changed."
            )

        return self._apply_filters(listings, filters)

    def _parse_grid(self, soup: BeautifulSoup) -> list[Listing]:
        products = (
            soup.select(".product-listing")
            or soup.select("[data-auto-id='productListingItem']")
            or soup.select(".listing-item")
            or soup.select("article")
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
        link_el = card.select_one("a[href]")
        if not link_el:
            return None
        href = link_el["href"]
        url = href if href.startswith("http") else f"https://marketplace.asos.com{href}"

        title_el = (
            card.select_one("[data-auto-id='productTitle']")
            or card.select_one(".product-title")
            or card.select_one("h2, h3, h4")
        )
        title = title_el.get_text(strip=True) if title_el else None
        if not title:
            return None

        price_el = card.select_one("[data-auto-id='productPrice']") or card.select_one(".price")
        price_gbp = self._parse_price(price_el.get_text(strip=True)) if price_el else None

        img_el = card.select_one("img[src], img[data-src]")
        image_url: Optional[str] = None
        if img_el:
            src = img_el.get("src") or img_el.get("data-src", "")
            image_url = src if src.startswith("http") else (f"https:{src}" if src.startswith("//") else None)

        return Listing(
            listing_id=self._make_listing_id(self.SITE_SLUG, url),
            url=url,
            title=title[:200],
            source_slug=self.SITE_SLUG,
            source_name=self.SITE_NAME,
            price_gbp=price_gbp,
            shipping_gbp=None,
            image_url=image_url,
            raw_description=title,
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
