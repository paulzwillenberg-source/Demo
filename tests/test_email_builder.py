"""Tests for the email template renderer and sender."""
import pytest

from src.email_builder.template import render_bulletin, render_subject


SAMPLE_ARTICLES = {
    "news": [
        {
            "title": "Big News Story",
            "url": "https://bbc.co.uk/news/1",
            "topic": "news",
            "source_name": "BBC",
            "image_url": None,
            "is_paywalled": False,
            "raw_text": "Details here.",
            "tags": [],
            "bullets": ["- First point", "- Second point", "- Third point"],
        }
    ],
    "business": [
        {
            "title": "Stock Market Update",
            "url": "https://wsj.com/article/1",
            "topic": "business",
            "source_name": "WSJ",
            "image_url": "https://example.com/img.jpg",
            "is_paywalled": True,
            "raw_text": "Market overview.",
            "tags": [],
            "bullets": ["- Market rose 1%"],
        }
    ],
}


class TestRenderBulletin:
    def test_renders_without_error(self):
        html = render_bulletin(
            user_name="Sarah",
            topics=["news", "business"],
            articles=SAMPLE_ARTICLES,
        )
        assert isinstance(html, str)
        assert len(html) > 100

    def test_includes_user_name(self):
        html = render_bulletin(
            user_name="Sarah",
            topics=["news"],
            articles=SAMPLE_ARTICLES,
        )
        assert "Sarah" in html

    def test_includes_article_title(self):
        html = render_bulletin(
            user_name="",
            topics=["news"],
            articles=SAMPLE_ARTICLES,
        )
        assert "Big News Story" in html

    def test_includes_bullet_points(self):
        html = render_bulletin(
            user_name="",
            topics=["news"],
            articles=SAMPLE_ARTICLES,
        )
        assert "First point" in html

    def test_marks_paywalled_articles(self):
        html = render_bulletin(
            user_name="",
            topics=["business"],
            articles=SAMPLE_ARTICLES,
        )
        assert "Premium" in html

    def test_marks_open_articles(self):
        html = render_bulletin(
            user_name="",
            topics=["news"],
            articles=SAMPLE_ARTICLES,
        )
        assert "Free" in html

    def test_skips_topics_with_no_articles(self):
        html = render_bulletin(
            user_name="",
            topics=["news", "politics", "celebrity"],
            articles={"news": SAMPLE_ARTICLES["news"], "politics": [], "celebrity": []},
        )
        # Politics and celebrity sections should not appear (no articles)
        assert "Politics" not in html
        assert "Celebrity" not in html

    def test_includes_unsubscribe_link(self):
        html = render_bulletin(
            user_name="",
            topics=["news"],
            articles=SAMPLE_ARTICLES,
            unsubscribe_url="https://yourdomain.com/unsubscribe/abc",
        )
        assert "Unsubscribe" in html
        assert "https://yourdomain.com/unsubscribe/abc" in html


class TestRenderSubject:
    def test_subject_contains_topics(self):
        subject = render_subject(["news", "business", "politics"])
        assert "News" in subject
        assert "Business" in subject

    def test_subject_contains_date(self):
        subject = render_subject(["news"], date="Monday, Feb 27")
        assert "Monday, Feb 27" in subject

    def test_subject_limits_to_three_topics(self):
        subject = render_subject(["news", "business", "politics", "celebrity", "marketing"])
        # Only first 3 topics should appear in subject
        parts = subject.split("|")[-1]
        assert parts.count("•") == 2  # 3 topics = 2 separators
