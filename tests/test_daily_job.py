"""Tests for the daily bulletin orchestration job."""
from unittest.mock import MagicMock, patch

import pytest

from src.scheduler.daily_job import run_daily_job


class TestRunDailyJob:
    @patch("src.scheduler.daily_job.get_all_active_users", return_value=[])
    def test_returns_zeros_when_no_users(self, mock_users):
        result = run_daily_job()
        assert result == {"total": 0, "sent": 0, "failed": 0}

    @patch("src.scheduler.daily_job.log_delivery")
    @patch("src.scheduler.daily_job.send_bulletin")
    @patch("src.scheduler.daily_job.render_subject", return_value="Daily Bulletin – Test")
    @patch("src.scheduler.daily_job.render_bulletin", return_value="<html>Test</html>")
    @patch("src.scheduler.daily_job.summarize_articles")
    @patch("src.scheduler.daily_job.fetch_articles_for_topics")
    @patch(
        "src.scheduler.daily_job.get_all_active_users",
        return_value=[
            {
                "id": "user-1",
                "email": "test@example.com",
                "name": "Test",
                "topics": ["news", "business"],
            }
        ],
    )
    @patch("src.scheduler.daily_job.settings")
    def test_sends_to_active_users(
        self,
        mock_settings,
        mock_users,
        mock_fetch,
        mock_summarize,
        mock_render,
        mock_subject,
        mock_send,
        mock_log,
    ):
        mock_settings.ANTHROPIC_API_KEY = ""
        mock_fetch.return_value = {"news": [], "business": []}
        mock_summarize.return_value = {"news": [], "business": []}
        mock_send.return_value = MagicMock(success=True, message="")

        result = run_daily_job()

        assert result["total"] == 1
        assert result["sent"] == 1
        assert result["failed"] == 0
        mock_send.assert_called_once()

    @patch("src.scheduler.daily_job.log_delivery")
    @patch("src.scheduler.daily_job.send_bulletin")
    @patch("src.scheduler.daily_job.render_subject", return_value="Subject")
    @patch("src.scheduler.daily_job.render_bulletin", return_value="<html/>")
    @patch("src.scheduler.daily_job.summarize_articles")
    @patch("src.scheduler.daily_job.fetch_articles_for_topics")
    @patch(
        "src.scheduler.daily_job.get_all_active_users",
        return_value=[
            {"id": "u1", "email": "a@example.com", "name": "A", "topics": ["news"]},
            {"id": "u2", "email": "b@example.com", "name": "B", "topics": ["business"]},
        ],
    )
    @patch("src.scheduler.daily_job.settings")
    def test_dry_run_skips_send(
        self,
        mock_settings,
        mock_users,
        mock_fetch,
        mock_summarize,
        mock_render,
        mock_subject,
        mock_send,
        mock_log,
    ):
        mock_settings.ANTHROPIC_API_KEY = ""
        mock_fetch.return_value = {}
        mock_summarize.return_value = {}

        result = run_daily_job(dry_run=True)

        assert result["total"] == 2
        assert result["sent"] == 2
        mock_send.assert_not_called()

    @patch("src.scheduler.daily_job.log_delivery")
    @patch("src.scheduler.daily_job.render_bulletin", side_effect=Exception("render error"))
    @patch("src.scheduler.daily_job.summarize_articles")
    @patch("src.scheduler.daily_job.fetch_articles_for_topics")
    @patch(
        "src.scheduler.daily_job.get_all_active_users",
        return_value=[
            {"id": "u1", "email": "fail@example.com", "name": "F", "topics": ["news"]},
        ],
    )
    @patch("src.scheduler.daily_job.settings")
    def test_handles_per_user_errors_gracefully(
        self,
        mock_settings,
        mock_users,
        mock_fetch,
        mock_summarize,
        mock_render,
        mock_log,
    ):
        mock_settings.ANTHROPIC_API_KEY = ""
        mock_fetch.return_value = {}
        mock_summarize.return_value = {}

        result = run_daily_job()
        assert result["failed"] == 1
        assert result["sent"] == 0

    @patch("src.scheduler.daily_job.log_delivery")
    @patch("src.scheduler.daily_job.send_bulletin")
    @patch("src.scheduler.daily_job.render_subject", return_value="Subject")
    @patch("src.scheduler.daily_job.render_bulletin", return_value="<html/>")
    @patch("src.scheduler.daily_job.summarize_articles")
    @patch("src.scheduler.daily_job.fetch_articles_for_topics")
    @patch(
        "src.scheduler.daily_job.get_all_active_users",
        return_value=[
            {"id": "u1", "email": "a@example.com", "name": "A", "topics": ["news", "business"]},
            {"id": "u2", "email": "b@example.com", "name": "B", "topics": ["news", "business"]},
        ],
    )
    @patch("src.scheduler.daily_job.settings")
    def test_caches_content_for_same_topics(
        self,
        mock_settings,
        mock_users,
        mock_fetch,
        mock_summarize,
        mock_render,
        mock_subject,
        mock_send,
        mock_log,
    ):
        mock_settings.ANTHROPIC_API_KEY = ""
        mock_fetch.return_value = {}
        mock_summarize.return_value = {}
        mock_send.return_value = MagicMock(success=True, message="")

        run_daily_job()

        # fetch_articles_for_topics should be called only once (cached for both users)
        assert mock_fetch.call_count == 1
