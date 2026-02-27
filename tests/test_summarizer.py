"""Tests for the AI summarizer."""
from unittest.mock import MagicMock, patch

import pytest

from src.aggregator.fetcher import Article
from src.summarizer.summarizer import summarize_article, summarize_articles


def _make_article(title="Test Article", raw_text="Some content here."):
    return Article(
        title=title,
        url="https://example.com",
        topic="news",
        source_name="Example",
        raw_text=raw_text,
    )


class TestSummarizeArticle:
    @patch("src.summarizer.summarizer.settings")
    def test_fallback_when_no_api_key(self, mock_settings):
        mock_settings.ANTHROPIC_API_KEY = ""
        article = _make_article()
        bullets = summarize_article(article)
        assert len(bullets) == 1
        assert article.title in bullets[0]

    def test_uses_claude_api_and_parses_bullets(self):
        article = _make_article()

        mock_client = MagicMock()
        mock_message = MagicMock()
        mock_message.content = [
            MagicMock(text="- First bullet\n- Second bullet\n- Third bullet")
        ]
        mock_client.messages.create.return_value = mock_message

        with patch("src.summarizer.summarizer.settings") as ms:
            ms.ANTHROPIC_API_KEY = "fake"
            bullets = summarize_article(article, client=mock_client)

        assert len(bullets) == 3
        assert all(b.startswith("-") for b in bullets)

    def test_handles_api_error_gracefully(self):
        article = _make_article()

        mock_client = MagicMock()
        mock_client.messages.create.side_effect = Exception("API error")

        with patch("src.summarizer.summarizer.settings") as ms:
            ms.ANTHROPIC_API_KEY = "fake"
            bullets = summarize_article(article, client=mock_client)

        assert len(bullets) == 1
        assert article.title in bullets[0]

    def test_limits_to_three_bullets(self):
        article = _make_article()

        mock_client = MagicMock()
        mock_message = MagicMock()
        mock_message.content = [
            MagicMock(text="- One\n- Two\n- Three\n- Four\n- Five")
        ]
        mock_client.messages.create.return_value = mock_message

        with patch("src.summarizer.summarizer.settings") as ms:
            ms.ANTHROPIC_API_KEY = "fake"
            bullets = summarize_article(article, client=mock_client)

        assert len(bullets) == 3


class TestSummarizeArticles:
    def test_enriches_all_articles(self):
        articles_by_topic = {
            "news": [_make_article("Article 1"), _make_article("Article 2")],
            "business": [_make_article("Biz Article")],
        }

        mock_client = MagicMock()
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text="- Bullet one\n- Bullet two\n- Bullet three")]
        mock_client.messages.create.return_value = mock_message

        with patch("src.summarizer.summarizer.settings") as ms:
            ms.ANTHROPIC_API_KEY = "fake"
            result = summarize_articles(articles_by_topic, client=mock_client)

        assert set(result.keys()) == {"news", "business"}
        assert len(result["news"]) == 2
        assert "bullets" in result["news"][0]
        assert "title" in result["news"][0]
