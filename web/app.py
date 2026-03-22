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

Podcast Summarizer Routes:
  GET  /podcast              – Podcast summarizer tool
  POST /podcast/search       – Search iTunes for podcasts
  POST /podcast/feed         – Fetch episodes from RSS feed
  POST /podcast/process      – Start async transcription + summarization job
  GET  /podcast/job/<job_id> – Poll job status / result
"""
from __future__ import annotations

import json
import logging
import os
import sys
import threading
import uuid

# Make project root importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from flask import (
    Flask,
    flash,
    jsonify,
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


# ─── Podcast Summarizer ───────────────────────────────────────────────────────

# In-memory job store: job_id → {status, steps, result, error}
_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()


@app.route("/podcast")
def podcast():
    return render_template("podcast.html")


@app.route("/podcast/search", methods=["POST"])
def podcast_search():
    from src.podcast.fetcher import search_podcasts
    query = request.json.get("query", "").strip()
    if not query:
        return jsonify({"error": "Query is required"}), 400
    try:
        results = search_podcasts(query)
        return jsonify({"results": results})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/podcast/feed", methods=["POST"])
def podcast_feed():
    from src.podcast.fetcher import parse_feed
    feed_url = request.json.get("feed_url", "").strip()
    if not feed_url:
        return jsonify({"error": "feed_url is required"}), 400
    try:
        data = parse_feed(feed_url)
        return jsonify(data)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/podcast/process", methods=["POST"])
def podcast_process():
    """Start a background job to transcribe and summarize an episode."""
    data = request.json or {}
    audio_url = data.get("audio_url", "").strip()
    transcript_url = data.get("transcript_url", "").strip() or None
    episode_title = data.get("episode_title", "Unknown Episode")
    podcast_title = data.get("podcast_title", "Unknown Podcast")

    if not audio_url and not transcript_url:
        return jsonify({"error": "audio_url or transcript_url is required"}), 400

    job_id = str(uuid.uuid4())
    with _jobs_lock:
        _jobs[job_id] = {"status": "pending", "steps": [], "result": None, "error": None}

    thread = threading.Thread(
        target=_run_job,
        args=(job_id, audio_url, transcript_url, episode_title, podcast_title),
        daemon=True,
    )
    thread.start()

    return jsonify({"job_id": job_id})


@app.route("/podcast/job/<job_id>")
def podcast_job_status(job_id: str):
    with _jobs_lock:
        job = _jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job)


def _run_job(
    job_id: str,
    audio_url: str,
    transcript_url: str | None,
    episode_title: str,
    podcast_title: str,
) -> None:
    """Worker: transcribe then summarize; update job store throughout."""

    def step(msg: str) -> None:
        with _jobs_lock:
            _jobs[job_id]["steps"].append(msg)
            _jobs[job_id]["status"] = "processing"

    try:
        from src.podcast.transcriber import get_transcript
        from src.podcast.summarizer import summarize_transcript

        step("Starting transcription...")
        transcript = get_transcript(
            audio_url=audio_url,
            transcript_url=transcript_url,
            progress=step,
        )
        step(f"Transcript ready ({len(transcript):,} characters).")

        summary = summarize_transcript(
            transcript=transcript,
            episode_title=episode_title,
            podcast_title=podcast_title,
            progress=step,
        )
        step("Summary complete.")

        with _jobs_lock:
            _jobs[job_id]["status"] = "done"
            _jobs[job_id]["result"] = {
                "summary": summary,
                "transcript": transcript,
                "episode_title": episode_title,
                "podcast_title": podcast_title,
            }
    except Exception as exc:
        logger.exception("Podcast job %s failed", job_id)
        with _jobs_lock:
            _jobs[job_id]["status"] = "error"
            _jobs[job_id]["error"] = str(exc)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    app.run(debug=settings.FLASK_ENV == "development", port=5000)
