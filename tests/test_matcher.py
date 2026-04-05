"""
Unit tests for src/matchers/preference_matcher.py
Pure logic tests — no I/O.
"""
from __future__ import annotations

import pytest

from src.aggregator.fetcher import Listing
from src.matchers.preference_matcher import match_listings, _size_matches


def _make_listing(**kwargs) -> Listing:
    defaults = dict(
        listing_id="abc123",
        url="https://example.com/item/1",
        title="1970s Brown Suede Fringe Jacket",
        source_slug="beyond_retro",
        source_name="Beyond Retro",
        price_gbp=48.0,
        size="UK 12",
        brand="Unknown",
        condition="Excellent",
        category="Jacket",
        style_tags=["suede", "fringe", "70s"],
    )
    defaults.update(kwargs)
    return Listing(**defaults)


# ── Keyword matching ──────────────────────────────────────────────────────────

def test_keyword_match_in_title():
    listing = _make_listing(title="1970s Suede Fringe Jacket")
    assert len(match_listings([listing], {"keywords": ["suede"]})) == 1


def test_keyword_match_in_style_tags():
    listing = _make_listing(style_tags=["fringe", "70s"])
    assert len(match_listings([listing], {"keywords": ["fringe"]})) == 1


def test_keyword_no_match():
    listing = _make_listing(title="Floral Summer Dress")
    assert len(match_listings([listing], {"keywords": ["leather"]})) == 0


def test_empty_keywords_matches_all():
    listings = [_make_listing(), _make_listing(listing_id="def456", url="https://example.com/2")]
    assert len(match_listings(listings, {"keywords": []})) == 2


# ── Brand matching ────────────────────────────────────────────────────────────

def test_brand_exact_match():
    listing = _make_listing(brand="Levi's")
    assert len(match_listings([listing], {"brands": ["Levi's"]})) == 1


def test_brand_case_insensitive():
    listing = _make_listing(brand="Levi's")
    assert len(match_listings([listing], {"brands": ["levi's"]})) == 1


def test_brand_no_match():
    listing = _make_listing(brand="Wrangler")
    assert len(match_listings([listing], {"brands": ["Levi's"]})) == 0


def test_empty_brands_matches_all():
    listing = _make_listing(brand="Any Brand")
    assert len(match_listings([listing], {"brands": []})) == 1


# ── Size matching ─────────────────────────────────────────────────────────────

def test_size_exact_match():
    listing = _make_listing(size="M")
    assert len(match_listings([listing], {"sizes": ["M"]})) == 1


def test_size_uk_numeric_match():
    listing = _make_listing(size="UK 12")
    assert len(match_listings([listing], {"sizes": ["12"]})) == 1


def test_size_no_match():
    listing = _make_listing(size="XL")
    assert len(match_listings([listing], {"sizes": ["S"]})) == 0


def test_empty_sizes_matches_all():
    listing = _make_listing(size="XXL")
    assert len(match_listings([listing], {"sizes": []})) == 1


# ── Price range ───────────────────────────────────────────────────────────────

def test_within_price_range():
    listing = _make_listing(price_gbp=50.0)
    assert len(match_listings([listing], {"price_min": 30.0, "price_max": 100.0})) == 1


def test_below_price_min():
    listing = _make_listing(price_gbp=20.0)
    assert len(match_listings([listing], {"price_min": 30.0})) == 0


def test_above_price_max():
    listing = _make_listing(price_gbp=150.0)
    assert len(match_listings([listing], {"price_max": 100.0})) == 0


def test_no_price_passes_range_check():
    listing = _make_listing(price_gbp=None)
    # Listings with unknown price are not filtered out by price range
    assert len(match_listings([listing], {"price_min": 10.0, "price_max": 50.0})) == 1


# ── Category matching ─────────────────────────────────────────────────────────

def test_category_match():
    listing = _make_listing(category="Jacket")
    assert len(match_listings([listing], {"categories": ["Jacket"]})) == 1


def test_category_no_match():
    listing = _make_listing(category="Dress")
    assert len(match_listings([listing], {"categories": ["Jacket"]})) == 0


def test_empty_categories_matches_all():
    listing = _make_listing(category="Trousers")
    assert len(match_listings([listing], {"categories": []})) == 1


# ── Combined constraints ──────────────────────────────────────────────────────

def test_all_constraints_pass():
    listing = _make_listing(
        title="1970s Suede Jacket",
        brand="Vintage Brand",
        size="12",
        price_gbp=60.0,
        category="Jacket",
        style_tags=["suede"],
    )
    prefs = {
        "keywords": ["suede"],
        "brands": ["Vintage Brand"],
        "sizes": ["12"],
        "price_min": 40.0,
        "price_max": 80.0,
        "categories": ["Jacket"],
    }
    assert len(match_listings([listing], prefs)) == 1


def test_one_constraint_fails_rejects_listing():
    listing = _make_listing(price_gbp=200.0)  # too expensive
    prefs = {
        "keywords": ["suede"],
        "price_max": 100.0,
    }
    assert len(match_listings([listing], prefs)) == 0


# ── Size helper ───────────────────────────────────────────────────────────────

def test_size_matches_exact():
    assert _size_matches("M", "M") is True


def test_size_matches_numeric_normalisation():
    assert _size_matches("UK 12", "12") is True
    assert _size_matches("Size 10", "10") is True


def test_size_no_match():
    assert _size_matches("S", "XL") is False
