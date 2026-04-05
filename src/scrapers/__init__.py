"""
Scraper registry — maps site slug → scraper class.

Add new scrapers here after creating their module.
"""
from __future__ import annotations

from src.scrapers.base import BaseScraper, ScraperError
from src.scrapers.beyond_retro import BeyondRetroScraper
from src.scrapers.thrifted import ThriftedScraper

# Tier 2 (imported lazily to allow partial installs)
try:
    from src.scrapers.asos_marketplace import ASOSMarketplaceScraper as _ASOS
    from src.scrapers.ebay_vintage import EbayVintageScraper as _eBay
    _TIER2: dict = {"asos_marketplace": _ASOS, "ebay_vintage": _eBay}
except ImportError:
    _TIER2 = {}

# Tier 3 — Playwright required; guarded import
try:
    from src.scrapers.depop import DepopScraper as _Depop
    from src.scrapers.vinted import VintedScraper as _Vinted
    _TIER3: dict = {"depop": _Depop, "vinted": _Vinted}
except ImportError:
    _TIER3 = {}

REGISTRY: dict[str, type[BaseScraper]] = {
    "beyond_retro": BeyondRetroScraper,
    "thrifted": ThriftedScraper,
    **_TIER2,
    **_TIER3,
}


def get_scraper(slug: str) -> BaseScraper:
    """Instantiate a scraper by its site slug. Raises KeyError if unknown."""
    cls = REGISTRY[slug]
    return cls()


__all__ = ["BaseScraper", "ScraperError", "REGISTRY", "get_scraper"]
