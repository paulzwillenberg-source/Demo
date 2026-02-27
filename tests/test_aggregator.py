"""Tests for the news aggregation fetcher."""
import types
from unittest.mock import MagicMock, patch

import pytest

from src.aggregator.fetcher import (
    Article,
    _is_paywalled,
    _source_name_from_url,
    fetch_articles_for_topics,
    fetch_newsapi,
    fetch_rss,
)


class TestHelpers:
    def test_source_name_from_url(self):
        assert _source_name_from_url("https://www.bbc.co.uk/news/rss.xml") == "Bbc"
        assert _source_name_from_url("https://nytimes.com/article") == "Nytimes"
        assert _source_name_from_url("not-a-url") == "Unknown"

    def test_is_paywalled_positive(self):
        assert _is_paywalled("https://www.wsj.com/articles/something")
        assert _is_paywalled("https://www.nytimes.com/2024/news")
        assert _is_paywalled("https://ft.com/content/abc")

    def test_is_paywalled_negative(self):
        assert not _is_paywalled("https://www.bbc.co.uk/news")
        assert not _is_paywalled("https://www.theguardian.com/world")


class TestFetchRss:
    def _make_entry(self, title="Test Article", link="https://example.com/1", summary="Summary text"):
        entry = MagicMock()
        entry.get = lambda k, default=None: {
            "title": title,
            "link": link,
            "summary": summary,
            "media_content": [],
            "enclosures": [],
        }.get(k, default)
        return entry

    @patch("src.aggregator.fetcher._feedparser")
    def test_returns_articles(self, mock_fp):
        mock_feed = MagicMock()
        mock_feed.entries = [self._make_entry()]
        mock_fp.parse.return_value = mock_feed

        articles = fetch_rss("news", max_articles=5)
        assert len(articles) >= 1
        assert isinstance(articles[0], Article)
        assert articles[0].title == "Test Article"

    @patch("src.aggregator.fetcher._feedparser")
    def test_handles_feed_error_gracefully(self, mock_fp):
        mock_fp.parse.side_effect = Exception("timeout")
        articles = fetch_rss("news", max_articles=5)
        assert isinstance(articles, list)  # Should not raise


class TestFetchNewsapi:
    @patch("src.aggregator.fetcher.settings")
    def test_returns_empty_when_no_api_key(self, mock_settings):
        mock_settings.NEWS_API_KEY = ""
        articles = fetch_newsapi("business")
        assert articles == []

    @patch("src.aggregator.fetcher.requests.get")
    @patch("src.aggregator.fetcher.settings")
    def test_returns_articles_from_api(self, mock_settings, mock_get):
        mock_settings.NEWS_API_KEY = "fake-key"
        mock_settings.NEWS_API_BASE = "https://newsapi.org/v2"
        mock_settings.ARTICLES_PER_TOPIC = 5
        mock_settings.PAYWALLED_SOURCES = {}

        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "articles": [
                {
                    "title": "Big News",
                    "url": "https://example.com/news",
                    "source": {"name": "Example"},
                    "urlToImage": None,
                    "description": "A great story.",
                    "content": None,
                }
            ]
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        articles = fetch_newsapi("business", max_articles=5)
        assert len(articles) == 1
        assert articles[0].title == "Big News"


class TestFetchArticlesForTopics:
    @patch("src.aggregator.fetcher.fetch_newsapi", return_value=[])
    @patch("src.aggregator.fetcher.fetch_rss")
    def test_aggregates_topics(self, mock_rss, mock_newsapi):
        mock_rss.return_value = [
            Article(title="A", url="https://a.com", topic="news", source_name="A"),
            Article(title="B", url="https://b.com", topic="news", source_name="B"),
        ]
        result = fetch_articles_for_topics(["news", "business"])
        assert "news" in result
        assert "business" in result
        assert len(result["news"]) == 2

    @patch("src.aggregator.fetcher.fetch_newsapi", return_value=[])
    @patch("src.aggregator.fetcher.fetch_rss", return_value=[])
    def test_handles_empty_feeds(self, mock_rss, mock_newsapi):
        result = fetch_articles_for_topics(["marketing"])
        assert result["marketing"] == []
