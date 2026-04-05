"""
Unit tests for Tier 1 scrapers (Beyond Retro, Thrifted).

All outbound HTTP is mocked via the `responses` library so tests run
without network access.
"""
from __future__ import annotations

import pytest
import responses as responses_lib

from src.scrapers.base import ScraperError
from src.scrapers.beyond_retro import BeyondRetroScraper
from src.scrapers.thrifted import ThriftedScraper

# ── Minimal HTML fixtures ─────────────────────────────────────────────────────

_BEYOND_RETRO_HTML = """
<html><body>
  <div class="grid__item">
    <a href="/products/70s-suede-jacket">
      <div class="product-item__title">1970s Suede Fringe Jacket</div>
      <span class="price">£48.00</span>
      <img src="//cdn.beyondretro.com/jacket.jpg" alt="jacket">
    </a>
  </div>
  <div class="grid__item">
    <a href="/products/vintage-coat">
      <div class="product-item__title">Vintage Wool Coat Size 10</div>
      <span class="price">£32.00</span>
      <img src="//cdn.beyondretro.com/coat.jpg" alt="coat">
    </a>
  </div>
</body></html>
"""

_THRIFTED_HTML = """
<html><body>
  <div class="product-card">
    <a href="/products/silk-blouse">
      <div class="product-card__title">Vintage Silk Blouse 1980s</div>
      <div class="price__regular">£22.00</div>
      <img src="https://cdn.thrifted.com/blouse.jpg" alt="blouse">
    </a>
  </div>
</body></html>
"""

_EMPTY_HTML = "<html><body><p>No results found.</p></body></html>"


# ── Beyond Retro ─────────────────────────────────────────────────────────────

class TestBeyondRetroScraper:
    @responses_lib.activate
    def test_returns_listings_for_valid_html(self, monkeypatch):
        monkeypatch.setattr("config.settings.SCRAPE_MAX_PAGES", 1)
        monkeypatch.setattr("config.settings.PROXY_URL", "")
        responses_lib.add(
            responses_lib.GET,
            "https://www.beyondretro.com/collections/all",
            body=_BEYOND_RETRO_HTML,
            status=200,
            content_type="text/html",
        )
        scraper = BeyondRetroScraper()
        listings = scraper.scrape(["suede jacket"], {})
        assert len(listings) == 2
        assert listings[0].source_slug == "beyond_retro"
        assert listings[0].title == "1970s Suede Fringe Jacket"
        assert listings[0].price_gbp == 48.0
        assert listings[0].image_url == "https://cdn.beyondretro.com/jacket.jpg"
        assert listings[0].url == "https://www.beyondretro.com/products/70s-suede-jacket"

    @responses_lib.activate
    def test_raises_scraper_error_on_empty_results(self, monkeypatch):
        monkeypatch.setattr("config.settings.SCRAPE_MAX_PAGES", 1)
        monkeypatch.setattr("config.settings.PROXY_URL", "")
        responses_lib.add(
            responses_lib.GET,
            "https://www.beyondretro.com/collections/all",
            body=_EMPTY_HTML,
            status=200,
            content_type="text/html",
        )
        scraper = BeyondRetroScraper()
        with pytest.raises(ScraperError, match="zero listings"):
            scraper.scrape(["nonexistent item xyz"], {})

    def test_raises_scraper_error_with_no_keywords(self):
        scraper = BeyondRetroScraper()
        with pytest.raises(ScraperError, match="no keywords"):
            scraper.scrape([], {})

    @responses_lib.activate
    def test_price_filter_applied(self, monkeypatch):
        monkeypatch.setattr("config.settings.SCRAPE_MAX_PAGES", 1)
        monkeypatch.setattr("config.settings.PROXY_URL", "")
        responses_lib.add(
            responses_lib.GET,
            "https://www.beyondretro.com/collections/all",
            body=_BEYOND_RETRO_HTML,
            status=200,
            content_type="text/html",
        )
        scraper = BeyondRetroScraper()
        listings = scraper.scrape(["jacket"], {"price_max": 40.0})
        # Only the £32 coat should pass the £40 ceiling
        assert all(l.price_gbp is None or l.price_gbp <= 40.0 for l in listings)

    @responses_lib.activate
    def test_listing_id_is_stable(self, monkeypatch):
        monkeypatch.setattr("config.settings.SCRAPE_MAX_PAGES", 1)
        monkeypatch.setattr("config.settings.PROXY_URL", "")
        responses_lib.add(
            responses_lib.GET,
            "https://www.beyondretro.com/collections/all",
            body=_BEYOND_RETRO_HTML,
            status=200,
            content_type="text/html",
        )
        scraper = BeyondRetroScraper()
        listings = scraper.scrape(["jacket"], {})
        # Same URL → same listing_id on repeated calls
        from src.scrapers.base import BaseScraper
        expected_id = BaseScraper._make_listing_id(
            "beyond_retro",
            "https://www.beyondretro.com/products/70s-suede-jacket",
        )
        assert listings[0].listing_id == expected_id

    @responses_lib.activate
    def test_raises_on_http_error(self, monkeypatch):
        monkeypatch.setattr("config.settings.SCRAPE_MAX_PAGES", 1)
        monkeypatch.setattr("config.settings.PROXY_URL", "")
        responses_lib.add(
            responses_lib.GET,
            "https://www.beyondretro.com/collections/all",
            status=404,
        )
        scraper = BeyondRetroScraper()
        with pytest.raises(ScraperError):
            scraper.scrape(["jacket"], {})


# ── Thrifted ──────────────────────────────────────────────────────────────────

class TestThriftedScraper:
    @responses_lib.activate
    def test_returns_listings_for_valid_html(self, monkeypatch):
        monkeypatch.setattr("config.settings.SCRAPE_MAX_PAGES", 1)
        monkeypatch.setattr("config.settings.PROXY_URL", "")
        responses_lib.add(
            responses_lib.GET,
            "https://thrifted.com/collections/all",
            body=_THRIFTED_HTML,
            status=200,
            content_type="text/html",
        )
        scraper = ThriftedScraper()
        listings = scraper.scrape(["silk blouse"], {})
        assert len(listings) == 1
        assert listings[0].source_slug == "thrifted"
        assert "Silk Blouse" in listings[0].title
        assert listings[0].price_gbp == 22.0

    @responses_lib.activate
    def test_raises_on_empty_results(self, monkeypatch):
        monkeypatch.setattr("config.settings.SCRAPE_MAX_PAGES", 1)
        monkeypatch.setattr("config.settings.PROXY_URL", "")
        responses_lib.add(
            responses_lib.GET,
            "https://thrifted.com/collections/all",
            body=_EMPTY_HTML,
            status=200,
            content_type="text/html",
        )
        scraper = ThriftedScraper()
        with pytest.raises(ScraperError, match="zero listings"):
            scraper.scrape(["nothing"], {})

    def test_raises_on_no_keywords(self):
        scraper = ThriftedScraper()
        with pytest.raises(ScraperError, match="no keywords"):
            scraper.scrape([], {})
