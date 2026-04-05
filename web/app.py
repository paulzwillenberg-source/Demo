"""
Flask web dashboard for the Daily Bulletin.

Routes:
  GET  /                 – Landing page
  GET  /signup           – Onboarding: topic selection + email
  POST /signup           – Handle signup form
  GET  /confirm/<token>  – Email confirmation
  GET  /dashboard/<uid>  – User dashboard
  GET  /preferences/<uid>– Edit topic preferences
  POST /preferences/<uid>– Save preferences
  GET  /credentials/<uid>– Manage paywalled source credentials
  POST /credentials/<uid>– Save / delete a credential pair
  GET  /unsubscribe/<uid>– Unsubscribe confirmation
  POST /unsubscribe/<uid>– Process unsubscribe
  GET  /preview/<uid>    – Preview today's bulletin (admin / dev)
"""
from __future__ import annotations

import logging
import os
import sys

# Make project root importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from flask import (
    Flask,
    flash,
    redirect,
    render_template,
    request,
    url_for,
)

from config import settings
from src.preferences.manager import (
    confirm_user,
    create_user,
    deactivate_user,
    get_user_by_email,
    get_user_by_id,
    init_db,
    update_preferences,
    get_vintage_preferences,
    upsert_vintage_preferences,
    get_recent_vintage_alerts,
    get_vintage_alert_stats,
    get_pending_digest_items,
)
from src.credentials.manager import (
    delete_credentials,
    list_sources,
    save_credentials,
)

logger = logging.getLogger(__name__)

app = Flask(__name__, template_folder="templates")
app.secret_key = settings.SECRET_KEY


# ─── Bootstrap ────────────────────────────────────────────────────────────────

with app.app_context():
    init_db()


# ─── Landing & Onboarding ─────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html", topics=settings.TOPICS)


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        email = request.form.get("email", "").strip()
        name = request.form.get("name", "").strip()
        topics = request.form.getlist("topics")

        if not email:
            flash("Please enter your email address.", "error")
            return redirect(url_for("signup"))
        if not topics:
            flash("Please select at least one topic.", "error")
            return redirect(url_for("signup"))

        # Check for existing account
        existing = get_user_by_email(email)
        if existing:
            flash("That email is already registered. Check your inbox for the confirmation link.", "info")
            return redirect(url_for("index"))

        user = create_user(email=email, name=name, topics=topics)

        # In production, send a confirmation email here.
        # For now, auto-confirm to simplify the demo flow.
        confirm_user(user["id"])

        flash("You're signed up! Your first bulletin will arrive tomorrow morning.", "success")
        return redirect(url_for("dashboard", uid=user["id"]))

    return render_template("onboarding.html", topics=settings.TOPICS)


# ─── Email confirmation ────────────────────────────────────────────────────────

@app.route("/confirm/<uid>")
def confirm(uid: str):
    user = get_user_by_id(uid)
    if not user:
        flash("Invalid confirmation link.", "error")
        return redirect(url_for("index"))
    confirm_user(uid)
    flash("Email confirmed! Welcome aboard.", "success")
    return redirect(url_for("dashboard", uid=uid))


# ─── Dashboard ────────────────────────────────────────────────────────────────

@app.route("/dashboard/<uid>")
def dashboard(uid: str):
    user = get_user_by_id(uid)
    if not user:
        flash("User not found.", "error")
        return redirect(url_for("index"))
    linked_sources = list_sources(uid)
    all_sources = settings.PAYWALLED_SOURCES
    return render_template(
        "dashboard.html",
        user=user,
        linked_sources=linked_sources,
        all_sources=all_sources,
        topics=settings.TOPICS,
    )


# ─── Preferences ──────────────────────────────────────────────────────────────

@app.route("/preferences/<uid>", methods=["GET", "POST"])
def preferences(uid: str):
    user = get_user_by_id(uid)
    if not user:
        flash("User not found.", "error")
        return redirect(url_for("index"))

    if request.method == "POST":
        name = request.form.get("name", "").strip()
        topics = request.form.getlist("topics")
        if not topics:
            flash("Please select at least one topic.", "error")
            return redirect(url_for("preferences", uid=uid))
        update_preferences(uid, name=name or None, topics=topics)
        flash("Preferences updated successfully.", "success")
        return redirect(url_for("dashboard", uid=uid))

    return render_template("preferences.html", user=user, topics=settings.TOPICS)


# ─── Credentials ──────────────────────────────────────────────────────────────

@app.route("/credentials/<uid>", methods=["GET", "POST"])
def credentials(uid: str):
    user = get_user_by_id(uid)
    if not user:
        flash("User not found.", "error")
        return redirect(url_for("index"))

    if request.method == "POST":
        action = request.form.get("action", "save")
        source_slug = request.form.get("source_slug", "").strip()

        if not source_slug or source_slug not in settings.PAYWALLED_SOURCES:
            flash("Invalid source.", "error")
            return redirect(url_for("credentials", uid=uid))

        if action == "delete":
            delete_credentials(uid, source_slug)
            flash(f"Credentials for {settings.PAYWALLED_SOURCES[source_slug]} removed.", "success")
        else:
            username = request.form.get("username", "").strip()
            password = request.form.get("password", "")
            if not username or not password:
                flash("Username and password are required.", "error")
                return redirect(url_for("credentials", uid=uid))
            save_credentials(uid, source_slug, username, password)
            flash(f"Credentials for {settings.PAYWALLED_SOURCES[source_slug]} saved.", "success")

        return redirect(url_for("credentials", uid=uid))

    linked_sources = list_sources(uid)
    return render_template(
        "credentials.html",
        user=user,
        paywalled_sources=settings.PAYWALLED_SOURCES,
        linked_sources=linked_sources,
    )


# ─── Unsubscribe ──────────────────────────────────────────────────────────────

@app.route("/unsubscribe/<uid>", methods=["GET", "POST"])
def unsubscribe(uid: str):
    user = get_user_by_id(uid)
    if not user:
        flash("User not found.", "error")
        return redirect(url_for("index"))

    if request.method == "POST":
        deactivate_user(uid)
        flash("You have been unsubscribed. We're sorry to see you go.", "info")
        return redirect(url_for("index"))

    return render_template("unsubscribe.html", user=user)


# ─── Dev: bulletin preview ────────────────────────────────────────────────────

@app.route("/preview/<uid>")
def preview(uid: str):
    """Render a live bulletin preview for a user (dev/admin use)."""
    user = get_user_by_id(uid)
    if not user:
        flash("User not found.", "error")
        return redirect(url_for("index"))

    from src.aggregator.fetcher import fetch_articles_for_topics
    from src.summarizer.summarizer import summarize_articles
    from src.email_builder.template import render_bulletin, render_subject

    articles_raw = fetch_articles_for_topics(user["topics"])
    articles_summarized = summarize_articles(articles_raw)
    html = render_bulletin(
        user_name=user.get("name", ""),
        topics=user["topics"],
        articles=articles_summarized,
        site_url=request.host_url.rstrip("/"),
        preferences_url=url_for("preferences", uid=uid, _external=True),
        credentials_url=url_for("credentials", uid=uid, _external=True),
        unsubscribe_url=url_for("unsubscribe", uid=uid, _external=True),
    )
    return html


# ─── Vintage Scout ────────────────────────────────────────────────────────────

_VINTAGE_SIZES = [
    "XXS", "XS", "S", "M", "L", "XL", "XXL",
    "6", "8", "10", "12", "14", "16", "18", "20",
]
_VINTAGE_CATEGORIES = [
    "Top", "Dress", "Jacket", "Coat", "Trousers", "Skirt", "Knitwear",
    "Shoes", "Accessories",
]
_VINTAGE_ALERT_FORMATS = [
    ("email_digest", "Email Digest"),
    ("email_instant", "Email Instant"),
    ("whatsapp_digest", "WhatsApp Digest"),
    ("whatsapp_instant", "WhatsApp Instant"),
]


@app.route("/vintage/<uid>")
def vintage_dashboard(uid: str):
    """Vintage Scout dashboard — match history and alert stats."""
    user = get_user_by_id(uid)
    if not user:
        flash("User not found.", "error")
        return redirect(url_for("index"))

    from src.scrapers import REGISTRY
    prefs = get_vintage_preferences(uid)
    recent_alerts = get_recent_vintage_alerts(uid, limit=20)
    alert_stats = get_vintage_alert_stats(uid)
    pending_count = len(get_pending_digest_items(uid))

    return render_template(
        "vintage_dashboard.html",
        user=user,
        prefs=prefs,
        recent_alerts=recent_alerts,
        alert_stats=alert_stats,
        pending_count=pending_count,
        available_scrapers=list(REGISTRY.keys()),
    )


@app.route("/vintage/preferences/<uid>", methods=["GET", "POST"])
def vintage_preferences(uid: str):
    """Edit vintage search preferences."""
    user = get_user_by_id(uid)
    if not user:
        flash("User not found.", "error")
        return redirect(url_for("index"))

    if request.method == "POST":
        keywords_raw = request.form.get("keywords", "")
        brands_raw = request.form.get("brands", "")
        sizes = request.form.getlist("sizes")
        categories = request.form.getlist("categories")
        enabled_sites = request.form.getlist("enabled_sites")
        alert_format = request.form.get("alert_format", "email_digest")
        whatsapp_number = request.form.get("whatsapp_number", "").strip() or None

        price_min_raw = request.form.get("price_min", "").strip()
        price_max_raw = request.form.get("price_max", "").strip()
        price_min = float(price_min_raw) if price_min_raw else None
        price_max = float(price_max_raw) if price_max_raw else None

        keywords = [k.strip() for k in keywords_raw.split(",") if k.strip()]
        brands = [b.strip() for b in brands_raw.split(",") if b.strip()]

        if alert_format in ("whatsapp_instant", "whatsapp_digest") and not whatsapp_number:
            flash("Please enter your WhatsApp number for WhatsApp alerts.", "error")
            return redirect(url_for("vintage_preferences", uid=uid))

        upsert_vintage_preferences(
            user_id=uid,
            brands=brands,
            sizes=sizes,
            price_min=price_min,
            price_max=price_max,
            keywords=keywords,
            categories=categories,
            enabled_sites=enabled_sites,
            alert_format=alert_format,
            whatsapp_number=whatsapp_number,
        )
        flash("Vintage preferences saved.", "success")
        return redirect(url_for("vintage_dashboard", uid=uid))

    from src.scrapers import REGISTRY
    prefs = get_vintage_preferences(uid) or {}
    return render_template(
        "vintage_preferences.html",
        user=user,
        prefs=prefs,
        sizes=_VINTAGE_SIZES,
        categories=_VINTAGE_CATEGORIES,
        alert_formats=_VINTAGE_ALERT_FORMATS,
        available_scrapers=list(REGISTRY.keys()),
    )


@app.route("/vintage/preview/<uid>")
def vintage_preview(uid: str):
    """Preview the current digest queue for a user (dev/admin use)."""
    user = get_user_by_id(uid)
    if not user:
        flash("User not found.", "error")
        return redirect(url_for("index"))

    import json as _json
    raw_items = get_pending_digest_items(uid)
    listings = [_json.loads(j) for j in raw_items]
    prefs = get_vintage_preferences(uid) or {}

    from src.email_builder.template import render_vintage_digest
    html = render_vintage_digest(
        listings=listings,
        total_count=len(listings),
        search_name="Vintage Search",
        app_url=url_for("vintage_dashboard", uid=uid, _external=True),
        manage_url=url_for("vintage_preferences", uid=uid, _external=True),
        unsubscribe_url=url_for("unsubscribe", uid=uid, _external=True),
    )
    return html


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    app.run(debug=settings.FLASK_ENV == "development", port=5000)
