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
from src.aggregator.fetcher import Article, Listing

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


_LISTING_PARSE_PROMPT = """You are a vintage clothing data extractor.
Given a listing title and description, extract the following fields as JSON.
Return ONLY a valid JSON object — no markdown, no explanation.

Fields:
  brand     (string or null)    — clothing brand if mentioned, else null
  condition (string or null)    — one of: "Mint", "Excellent", "Good", "Fair", or null
  category  (string or null)    — one of: "Top", "Dress", "Jacket", "Coat", "Trousers",
                                   "Skirt", "Knitwear", "Shoes", "Accessories", or null
  style_tags (array of strings) — up to 5 descriptive tags (e.g. ["70s", "suede", "fringe"])

Example output:
{"brand": "Levi's", "condition": "Excellent", "category": "Jacket", "style_tags": ["denim", "70s", "vintage"]}"""


def parse_listing(
    listing: Listing,
    client: Optional[anthropic.Anthropic] = None,
) -> Listing:
    """
    Use Claude Haiku to extract structured fields from a listing's raw description.

    Populates: brand, condition, category, style_tags.
    Falls back to the original Listing unchanged if the API call or JSON parse fails.
    """
    if not settings.ANTHROPIC_API_KEY:
        logger.debug("ANTHROPIC_API_KEY not set; skipping listing enrichment.")
        return listing

    if client is None:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    content = listing.raw_description.strip() or listing.title
    user_prompt = f"Title: {listing.title}\n\nDescription:\n{content[:1500]}"

    try:
        import json
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            system=_LISTING_PARSE_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = message.content[0].text.strip()
        parsed = json.loads(raw)

        # Apply extracted fields, preserving existing values scrapers already set
        return Listing(
            listing_id=listing.listing_id,
            url=listing.url,
            title=listing.title,
            source_slug=listing.source_slug,
            source_name=listing.source_name,
            price_gbp=listing.price_gbp,
            shipping_gbp=listing.shipping_gbp,
            size=listing.size,
            brand=listing.brand or parsed.get("brand"),
            condition=listing.condition or parsed.get("condition"),
            category=listing.category or parsed.get("category"),
            location=listing.location,
            style_tags=listing.style_tags or parsed.get("style_tags", []),
            image_url=listing.image_url,
            raw_description=listing.raw_description,
            scraped_at=listing.scraped_at,
        )
    except Exception as exc:
        logger.warning("parse_listing failed for '%s': %s", listing.title, exc)
        return listing


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
