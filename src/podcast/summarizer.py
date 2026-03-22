"""
Podcast summarizer: use Claude to produce structured episode summaries.
"""
from __future__ import annotations

import json
import re
from typing import Callable

import anthropic

from config import settings


def summarize_transcript(
    transcript: str,
    episode_title: str,
    podcast_title: str,
    progress: Callable[[str], None] | None = None,
) -> dict:
    """
    Send the transcript to Claude and return a structured summary dict with:
      - tldr: str
      - key_topics: list[str]
      - notable_quotes: list[{quote, context}]
      - action_items: list[str]
    """
    if progress:
        progress("Generating AI summary with Claude...")

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    # Keep tokens manageable — ~100k chars is plenty for a podcast
    MAX_CHARS = 100_000
    truncated = len(transcript) > MAX_CHARS
    body = transcript[:MAX_CHARS]
    if truncated:
        body += "\n\n[Transcript truncated due to length]"

    prompt = f"""You are analyzing a podcast episode transcript. Provide a comprehensive, structured summary.

Podcast: {podcast_title}
Episode: {episode_title}

Transcript:
{body}

Respond with valid JSON only — no markdown fences, no prose outside the JSON object:
{{
  "tldr": "2–3 sentence overview of the episode",
  "key_topics": ["topic 1", "topic 2", "..."],
  "notable_quotes": [
    {{"quote": "exact or near-exact quote from the transcript", "context": "brief context for the quote"}},
    "..."
  ],
  "action_items": ["actionable takeaway 1", "actionable takeaway 2", "..."]
}}

Requirements:
- 5–8 key_topics
- 3–5 notable_quotes (use the speaker's actual words)
- 3–6 action_items (concrete, practical)"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text
    # Extract JSON object even if Claude wraps it in backticks
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise ValueError(f"Claude did not return valid JSON: {raw[:200]}")
    return json.loads(match.group())
