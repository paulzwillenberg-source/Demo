"""
APScheduler entry point.

Runs two daily jobs at the configured hour/minute:
  1. daily_bulletin  – personalized news digest for all subscribers
  2. podcast_watcher – checks RSS feeds for new episodes, sends summary email

Start with:  python scheduler.py
"""
import logging
import sys

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from config import settings
from src.scheduler.daily_job import run_daily_job
from src.scheduler.podcast_job import run_podcast_job

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)


def main() -> None:
    scheduler = BlockingScheduler(timezone=settings.TIMEZONE)
    trigger = CronTrigger(
        hour=settings.SEND_HOUR,
        minute=settings.SEND_MINUTE,
        timezone=settings.TIMEZONE,
    )

    scheduler.add_job(run_daily_job, trigger, id="daily_bulletin", replace_existing=True)
    scheduler.add_job(run_podcast_job, trigger, id="podcast_watcher", replace_existing=True)

    logger.info(
        "Scheduler started. Both jobs will run daily at %02d:%02d %s.",
        settings.SEND_HOUR,
        settings.SEND_MINUTE,
        settings.TIMEZONE,
    )
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped.")


if __name__ == "__main__":
    main()
