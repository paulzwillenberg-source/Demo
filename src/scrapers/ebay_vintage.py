"""
eBay Vintage scraper — Tier 2 (stable HTML, official-style URL parameters).

Scrapes eBay's search results filtered to the vintage clothing category
using eBay's public search URL. This is distinct from the eBay Finding API
(which is used for official API access with EBAY_APP_ID).

Category 11450 = Women's Vintage Clothing on eBay.
Uses Buy-It-Now filter to exclude auction items with unknown final prices.
Low anti-scraping risk but respect rate limits to stay within ToS.
"""
from __future__ import annotations

import logging
from typing import Optional

from bs4 import BeautifulSoup

from config import settings
from src.aggregator.fetcher import Listing
from src.scrapers.base import BaseScraper, ScraperError

logger = logging.getLogger(__name__)

_SITE_SLUG = "ebay_vintage"
_SITE_NAME = "eBay"
_SEARCH_URL = "https://www.ebay.co.uk/sch/i.html"

# eBay vintage clothing category IDs (UK)
_VINTAGE_CATEGORY = "11450"  # Women's Vintage
# LH_BIN=1 → Buy It Now only; LH_ItemCondition=3000 → Used
_FIXED_PARAMS = {
    "_sacat": _VINTAGE_CATEGORY,
    "LH_BIN": "1",
    "LH_ItemCondition": "3000",
}


class EbayVintageScraper(BaseScraper):
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
            params = {
                "_nkw": query,
                "_pgn": page,
                **_FIXED_PARAMS,
            }
            if filters.get("price_min"):
                params["_udlo"] = filters["price_min"]
            if filters.get("price_max"):
                params["_udhi"] = filters["price_max"]

            logger.debug("%s: fetching page %d (q=%r)", self.SITE_SLUG, page, query)
            resp = self._get_with_backoff(_SEARCH_URL, params=params)
            soup = BeautifulSoup(resp.text, "lxml")

            page_listings = self._parse_results(soup)
            if not page_listings:
                break

            listings.extend(page_listings)
            logger.info("%s: page %d → %d listings (total: %d)", self.SITE_SLUG, page, len(page_listings), len(listings))
            if page < max_pages:
                self._sleep(2.0)

        if not listings:
            raise ScraperError(
                f"{self.SITE_SLUG}: zero listings for query {query!r}. Markup may have changed."
            )

        return listings

    def _parse_results(self, soup: BeautifulSoup) -> list[Listing]:
        items = (
            soup.select(".s-item__wrapper")
            or soup.select("li.s-item")
            or soup.select("[data-view='mi:1686|iid:1']")
        )
        listings: list[Listing] = []
        for item in items:
            try:
                listing = self._parse_item(item)
                if listing:
                    listings.append(listing)
            except Exception as exc:
                logger.debug("%s: skipping item: %s", self.SITE_SLUG, exc)
        return listings

    def _parse_item(self, item) -> Optional[Listing]:
        link_el = item.select_one("a.s-item__link") or item.select_one("a[href*='ebay']")
        if not link_el:
            return None
        url = link_el.get("href", "")
        if not url or "ebay" not in url:
            return None

        title_el = item.select_one(".s-item__title") or item.select_one("h3")
        title = title_el.get_text(strip=True) if title_el else None
        # eBay sometimes has a "Shop on eBay" placeholder item
        if not title or title.lower() == "shop on ebay":
            return None

        price_el = item.select_one(".s-item__price") or item.select_one("[class*='price']")
        price_gbp = self._parse_price(price_el.get_text(strip=True)) if price_el else None

        shipping_el = item.select_one(".s-item__shipping")
        shipping_text = shipping_el.get_text(strip=True) if shipping_el else ""
        if "free" in shipping_text.lower():
            shipping_gbp: Optional[float] = 0.0
        else:
            shipping_gbp = self._parse_price(shipping_text) if shipping_text else None

        img_el = item.select_one("img.s-item__image-img") or item.select_one("img[src]")
        image_url: Optional[str] = None
        if img_el:
            src = img_el.get("src") or img_el.get("data-src", "")
            image_url = src if src.startswith("http") else None

        location_el = item.select_one(".s-item__location")
        location = location_el.get_text(strip=True).replace("From ", "") if location_el else None

        condition_el = item.select_one(".s-item__condition")
        condition = condition_el.get_text(strip=True) if condition_el else None

        return Listing(
            listing_id=self._make_listing_id(self.SITE_SLUG, url),
            url=url,
            title=title[:200],
            source_slug=self.SITE_SLUG,
            source_name=self.SITE_NAME,
            price_gbp=price_gbp,
            shipping_gbp=shipping_gbp,
            condition=condition,
            location=location,
            image_url=image_url,
            raw_description=title,
        )
