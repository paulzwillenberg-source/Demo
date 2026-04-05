"""
Preference matcher — filters scraped listings against a user's saved preferences.

All active constraints are ANDed together. An empty list for any dimension
means "match all" for that dimension, so users with minimal preferences
still receive results.
"""
from __future__ import annotations

import logging
from typing import Optional

from src.aggregator.fetcher import Listing

logger = logging.getLogger(__name__)


def match_listings(listings: list[Listing], prefs: dict) -> list[Listing]:
    """
    Return the subset of listings that satisfy every non-empty preference.

    Args:
        listings: Raw listings from one or more scrapers.
        prefs:    User's vintage_preferences dict from the database, with
                  keys: keywords, brands, sizes, price_min, price_max,
                  categories, enabled_sites (all already JSON-decoded lists).

    Returns:
        Filtered list of Listing objects.
    """
    matched = []
    for listing in listings:
        if _matches(listing, prefs):
            matched.append(listing)
    logger.debug(
        "Matcher: %d/%d listings passed for prefs user_id=%s",
        len(matched), len(listings), prefs.get("user_id", "?"),
    )
    return matched


def _matches(listing: Listing, prefs: dict) -> bool:
    # ── Keywords (any keyword must appear in title, tags, or brand) ───────────
    keywords: list[str] = prefs.get("keywords") or []
    if keywords:
        haystack = " ".join(
            filter(None, [listing.title, listing.brand, " ".join(listing.style_tags)])
        ).lower()
        if not any(kw.lower() in haystack for kw in keywords):
            return False

    # ── Brands ────────────────────────────────────────────────────────────────
    brands: list[str] = prefs.get("brands") or []
    if brands and listing.brand:
        if not any(b.lower() == (listing.brand or "").lower() for b in brands):
            return False

    # ── Sizes ─────────────────────────────────────────────────────────────────
    sizes: list[str] = prefs.get("sizes") or []
    if sizes and listing.size:
        if not any(_size_matches(listing.size, s) for s in sizes):
            return False

    # ── Price range ───────────────────────────────────────────────────────────
    price_min: Optional[float] = prefs.get("price_min")
    price_max: Optional[float] = prefs.get("price_max")
    if listing.price_gbp is not None:
        if price_min is not None and listing.price_gbp < price_min:
            return False
        if price_max is not None and listing.price_gbp > price_max:
            return False

    # ── Categories ────────────────────────────────────────────────────────────
    categories: list[str] = prefs.get("categories") or []
    if categories and listing.category:
        if not any(c.lower() == (listing.category or "").lower() for c in categories):
            return False

    return True


def _size_matches(listing_size: str, pref_size: str) -> bool:
    """
    Flexible size comparison: handles exact match, numeric UK sizes,
    and letter sizes (S, M, L, XL).
    """
    ls = listing_size.strip().upper()
    ps = pref_size.strip().upper()
    if ls == ps:
        return True
    # Normalise: "UK 12" == "12" == "SIZE 12"
    import re
    ls_num = re.sub(r"[^0-9]", "", ls)
    ps_num = re.sub(r"[^0-9]", "", ps)
    if ls_num and ps_num and ls_num == ps_num:
        return True
    return False
