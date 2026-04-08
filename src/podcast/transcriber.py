"""
Podcast transcriber: use existing transcripts when available, fall back to Whisper.
Audio is streamed to a temporary file and deleted after transcription.
"""
from __future__ import annotations

import os
import re
import tempfile
from typing import Callable

import requests


def get_transcript(
    audio_url: str,
    transcript_url: str | None = None,
    progress: Callable[[str], None] | None = None,
) -> str:
    """
    Return transcript text for an episode.

    Strategy:
    1. If transcript_url is provided, try downloading it first.
    2. Fall back to Whisper transcription of the audio stream.
    """
    if transcript_url:
        _emit(progress, "Checking for existing transcript...")
        text = _fetch_existing_transcript(transcript_url)
        if text:
            _emit(progress, "Existing transcript found.")
            return text
        _emit(progress, "Transcript URL failed; falling back to Whisper.")

    return _transcribe_with_whisper(audio_url, progress)


# ── Existing transcript ────────────────────────────────────────────────────────

def _fetch_existing_transcript(url: str) -> str | None:
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")

        if "json" in content_type or url.endswith(".json"):
            data = resp.json()
            segments = data.get("segments", [])
            return " ".join(s.get("body", "") for s in segments) or None

        text = resp.text
        if url.endswith(".srt") or url.endswith(".vtt") or "vtt" in content_type:
            text = _strip_subtitle_formatting(text)
        return text.strip() or None
    except Exception:
        return None


def _strip_subtitle_formatting(text: str) -> str:
    text = re.sub(r"WEBVTT.*?\n", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"\d+:\d+:\d+[\.,]\d+ --> \d+:\d+:\d+[\.,]\d+", "", text)
    text = re.sub(r"^\d+\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ── Whisper ────────────────────────────────────────────────────────────────────

def _transcribe_with_whisper(
    audio_url: str,
    progress: Callable[[str], None] | None,
) -> str:
    import whisper

    _emit(progress, "Streaming audio (temporary file, deleted after transcription)...")

    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp_path = tmp.name
        with requests.get(audio_url, stream=True, timeout=60) as r:
            r.raise_for_status()
            for chunk in r.iter_content(chunk_size=65536):
                tmp.write(chunk)

    try:
        _emit(progress, "Loading Whisper model (base)...")
        model = whisper.load_model("base")

        _emit(progress, "Transcribing audio — this may take a few minutes...")
        result = model.transcribe(tmp_path)
        return result["text"]
    finally:
        os.unlink(tmp_path)


def _emit(fn: Callable | None, msg: str) -> None:
    if fn:
        fn(msg)
