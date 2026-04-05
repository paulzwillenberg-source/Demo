"""
APScheduler entry point.

Registers:
  - daily_bulletin   : daily news digest (existing)
  - vintage_scrape   : vintage listings scrape + instant alerts (every N min)
  - vintage_digest   : vintage digest flush (daily at VINTAGE_DIGEST_HOUR)

Start with:  python scheduler.py
"""
import logging
import sys

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from config import settings
from src.scheduler.daily_job import run_daily_job
from src.scheduler.vintage_job import run_vintage_scrape_job, run_vintage_digest_job

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

    # ── Vintage Scout jobs ──────────────────────────────────────────────────
    scrape_trigger = IntervalTrigger(minutes=settings.SCRAPE_INTERVAL_MINUTES)
    scheduler.add_job(
        run_vintage_scrape_job,
        scrape_trigger,
        id="vintage_scrape",
        replace_existing=True,
    )

    digest_trigger = CronTrigger(
        hour=settings.VINTAGE_DIGEST_HOUR,
        minute=settings.VINTAGE_DIGEST_MINUTE,
        timezone=settings.TIMEZONE,
    )
    scheduler.add_job(
        run_vintage_digest_job,
        digest_trigger,
        id="vintage_digest",
        replace_existing=True,
    )

    logger.info(
        "Scheduler started. Bulletin: %02d:%02d %s | Vintage scrape: every %d min | Vintage digest: %02d:%02d %s.",
        settings.SEND_HOUR,
        settings.SEND_MINUTE,
        settings.TIMEZONE,
        settings.SCRAPE_INTERVAL_MINUTES,
        settings.VINTAGE_DIGEST_HOUR,
        settings.VINTAGE_DIGEST_MINUTE,
        settings.TIMEZONE,
    )
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped.")


if __name__ == "__main__":
    main()
