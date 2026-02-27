"""
APScheduler entry point.

Runs the daily bulletin job at the configured hour/minute in the configured
timezone. Start with:  python scheduler.py
"""
import logging
import sys

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from config import settings
from src.scheduler.daily_job import run_daily_job

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
    logger.info(
        "Scheduler started. Bulletin will be sent daily at %02d:%02d %s.",
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
