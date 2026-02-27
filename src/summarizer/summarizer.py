"""
AI-powered article summarizer using Anthropic Claude.

Given a list of Article objects, this module generates concise bullet-point
summaries suitable for inclusion in the daily email bulletin.
"""
from __future__ import annotations

import logging
from typing import Optional

import anthropic

from config import settings
from src.aggregator.fetcher import Article

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are an expert news editor for a personalized daily bulletin.
Your job is to distill each news article into exactly 3 concise bullet points that:
- Capture the most important facts and context
- Use plain, accessible language suitable for busy professionals
- Remain neutral and factual in tone
- Each bullet is one sentence, starting with a dash (-)

Respond ONLY with the 3 bullet points, nothing else."""


def _build_user_prompt(title: str, raw_text: str) -> str:
    content = raw_text.strip() or "(No article body available — summarize from the title only.)"
    return f"Article title: {title}\n\nArticle excerpt:\n{content}"


def summarize_article(
    article: Article,
    client: Optional[anthropic.Anthropic] = None,
) -> list[str]:
    """
    Return a list of 3 bullet-point strings summarizing the article.

    Falls back to a single-bullet title-based placeholder if the API call fails.
    """
    if not settings.ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set; using title-only fallback summary.")
        return [f"- {article.title}"]

    if client is None:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            system=_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": _build_user_prompt(article.title, article.raw_text),
                }
            ],
        )
        raw = message.content[0].text.strip()
        bullets = [line.strip() for line in raw.splitlines() if line.strip().startswith("-")]
        if not bullets:
            bullets = [f"- {line.strip()}" for line in raw.splitlines() if line.strip()]
        return bullets[:3] if bullets else [f"- {article.title}"]
    except Exception as exc:
        logger.error("Summarization failed for article '%s': %s", article.title, exc)
        return [f"- {article.title}"]


def summarize_articles(
    articles_by_topic: dict[str, list[Article]],
    client: Optional[anthropic.Anthropic] = None,
) -> dict[str, list[dict]]:
    """
    Summarize all articles across all topics.

    Returns a dict mapping topic -> list of enriched article dicts that include
    the generated bullet summaries alongside original article metadata.
    """
    if client is None and settings.ANTHROPIC_API_KEY:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    result: dict[str, list[dict]] = {}

    for topic, articles in articles_by_topic.items():
        enriched = []
        for article in articles:
            bullets = summarize_article(article, client=client)
            entry = article.to_dict()
            entry["bullets"] = bullets
            enriched.append(entry)
            logger.debug("Summarized '%s' -> %d bullets", article.title, len(bullets))
        result[topic] = enriched
        logger.info("Summarized %d article(s) for topic '%s'.", len(enriched), topic)

    return result
