import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    if (!config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY not configured');
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

export interface StorySummary {
  narrative: string;
  keyPoints: string[];
  whyItMatters: string;
  whatToWatch: string;
}

const SUMMARY_SYSTEM_PROMPT = `You are an expert news analyst producing structured summaries for a senior executive intelligence briefing.

Given article text, produce a JSON object with exactly these fields:
- narrative: A 3-5 sentence narrative summary of the story
- keyPoints: An array of 3-5 bullet strings (concise, factual)
- whyItMatters: One paragraph explaining significance and second-order effects
- whatToWatch: One sentence forward-looking indicator to watch

Respond with valid JSON only. No markdown fences.`;

const PARTIAL_SYSTEM_PROMPT = `You are an expert news analyst. The article text may be truncated due to a paywall. Produce the best summary possible with what is available, noting limitations.

Produce a JSON object with exactly these fields:
- narrative: A 3-5 sentence narrative summary (note if truncated)
- keyPoints: An array of 3-5 bullet strings
- whyItMatters: One paragraph explaining significance
- whatToWatch: One sentence forward-looking indicator

Respond with valid JSON only. No markdown fences.`;

export async function summarizeStory(
  text: string,
  headline: string,
  isAuthenticated: boolean
): Promise<StorySummary> {
  const anthropic = getClient();
  const model = 'claude-haiku-4-5-20251001';
  const systemPrompt = isAuthenticated ? SUMMARY_SYSTEM_PROMPT : PARTIAL_SYSTEM_PROMPT;

  const truncated = text.slice(0, 6000);

  const message = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Headline: ${headline}\n\nArticle text:\n${truncated}`,
      },
    ],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const parsed = JSON.parse(raw) as StorySummary;
  return parsed;
}

const BRIEFING_SYSTEM_PROMPT = `You are the chief intelligence analyst for a senior executive's personal media briefing service (PMIP). Your job is to synthesise the most important cross-source narrative from the last several hours of news.

Given a list of stories with their headlines, summaries, and source names, produce a JSON object with exactly these fields:

- leadHeadline: A punchy single headline capturing the most important macro narrative
- leadNarrative: Object with:
  - headline: Same as leadHeadline
  - paragraphs: Array of exactly 2 paragraph strings — analytical, cited, forward-looking
  - citations: Array of {label, url} objects for sources cited in the paragraphs
- sections: Array of topic section objects, each with:
  - label: Topic cluster name
  - stories: Array of {headline, summary, sourceCount, url} — 2-5 stories per section
- storyCount: Number of stories analysed
- topicCount: Number of distinct topic sections

Write with the register of a Bloomberg Intelligence analyst — precise, economical, cited. No filler.
Respond with valid JSON only. No markdown fences.`;

export async function generateBriefingContent(
  stories: { headline: string; summary: string; source: string; url: string; clusterLabel: string | null }[],
  windowHours: number
): Promise<any> {
  const anthropic = getClient();
  const model = 'claude-sonnet-4-6';

  const storiesText = stories
    .map(s => `[${s.source}] [${s.clusterLabel || 'General'}] ${s.headline}\nSummary: ${s.summary}\nURL: ${s.url}`)
    .join('\n\n');

  const message = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: BRIEFING_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Produce a macro briefing from the following ${stories.length} stories published in the last ${windowHours} hours:\n\n${storiesText}`,
      },
    ],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}';
  return JSON.parse(raw);
}
