"""
Email delivery via SendGrid.

Sends the rendered HTML bulletin to a subscriber. Falls back to a simple
SMTP/dry-run log when no SendGrid key is configured (useful for local dev).
"""
from __future__ import annotations

import logging
import smtplib
from dataclasses import dataclass
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import settings

logger = logging.getLogger(__name__)


@dataclass
class DeliveryResult:
    success: bool
    message: str = ""
    status_code: int = 0


def send_bulletin(
    to_email: str,
    to_name: str,
    subject: str,
    html_body: str,
) -> DeliveryResult:
    """
    Send the bulletin email to a single recipient.

    Uses SendGrid when SENDGRID_API_KEY is set; otherwise logs the email
    for development/testing purposes.
    """
    if settings.SENDGRID_API_KEY:
        return _send_via_sendgrid(to_email, to_name, subject, html_body)
    else:
        return _send_dry_run(to_email, subject, html_body)


def _send_via_sendgrid(
    to_email: str,
    to_name: str,
    subject: str,
    html_body: str,
) -> DeliveryResult:
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Email, To, Content

        sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        mail = Mail(
            from_email=Email(settings.FROM_EMAIL, settings.FROM_NAME),
            to_emails=To(to_email, to_name),
            subject=subject,
            html_content=Content("text/html", html_body),
        )
        response = sg.send(mail)
        if response.status_code in (200, 202):
            logger.info("Bulletin sent to %s via SendGrid (status=%d).", to_email, response.status_code)
            return DeliveryResult(success=True, status_code=response.status_code)
        else:
            logger.warning(
                "SendGrid returned unexpected status %d for %s.",
                response.status_code,
                to_email,
            )
            return DeliveryResult(
                success=False,
                message=f"Unexpected status code: {response.status_code}",
                status_code=response.status_code,
            )
    except Exception as exc:
        logger.error("Failed to send bulletin to %s: %s", to_email, exc)
        return DeliveryResult(success=False, message=str(exc))


def _send_dry_run(to_email: str, subject: str, html_body: str) -> DeliveryResult:
    """Log the email details instead of actually sending (dev mode)."""
    preview_chars = 200
    logger.info(
        "[DRY RUN] Would send email to=%s subject='%s' html_preview=%.%ds...",
        to_email,
        subject,
        preview_chars,
        html_body,
    )
    return DeliveryResult(success=True, message="dry-run", status_code=0)


def send_bulk(recipients: list[dict], subject: str, html_body: str) -> list[dict]:
    """
    Send the same bulletin to multiple recipients.

    Each recipient dict should have keys: email, name.
    Returns a list of result dicts with email + success status.
    """
    results = []
    for recipient in recipients:
        result = send_bulletin(
            to_email=recipient["email"],
            to_name=recipient.get("name", ""),
            subject=subject,
            html_body=html_body,
        )
        results.append(
            {
                "email": recipient["email"],
                "success": result.success,
                "message": result.message,
            }
        )
    return results
