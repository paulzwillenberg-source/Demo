import Parser from 'rss-parser';
import { prisma, isDatabaseConfigured } from '../lib/prisma';
import { summarizeStory } from './summarize';

const parser = new Parser({ timeout: 10000 });

/** Decode common HTML entities returned by RSS feeds */
function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export async function runIngest(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.log('[Ingest] No database configured — skipping live ingest, using mock data');
    return;
  }

  console.log('[Ingest] Starting ingest run...');

  // Fetch all active web sources from DB
  const sources = await prisma.source.findMany({ where: { isActive: true, type: 'WEB' } });
  let newCount = 0;
  const newStoryIds: string[] = [];

  for (const source of sources) {
    if (!source.feedUrl) continue;
    try {
      const feed = await parser.parseURL(source.feedUrl);
      for (const item of feed.items.slice(0, 20)) {
        const url = item.link || item.guid;
        if (!url) continue;

        // Skip if URL already exists
        const existing = await prisma.story.findUnique({ where: { url } });
        if (existing) continue;

        const headline = decodeHtml(item.title || 'Untitled');
        const fullText = item.content || item.contentSnippet || item.summary || null;

        const story = await prisma.story.create({
          data: {
            sourceId: source.id,
            headline,
            url,
            publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            fullText,
          },
        });
        newStoryIds.push(story.id);
        newCount++;
      }
    } catch (err: any) {
      console.warn(`[Ingest] Failed to fetch ${source.name}: ${err.message}`);
    }
  }

  console.log(`[Ingest] Saved ${newCount} new stories. Starting summarization...`);

  // Summarize new stories in background (don't await, errors are logged)
  summarizeNewStories(newStoryIds).catch(err =>
    console.error('[Ingest] Summarization error:', err.message)
  );
}

/** Summarize a batch of newly ingested stories, skipping any that already have summaries */
async function summarizeNewStories(storyIds: string[]): Promise<void> {
  if (storyIds.length === 0) return;

  const stories = await prisma.story.findMany({
    where: { id: { in: storyIds }, summary: null },
    include: { source: true },
  });

  for (const story of stories) {
    try {
      // Use fullText if available, fall back to headline
      const text = story.fullText || story.headline;
      const summary = await summarizeStory(text, story.headline, story.source.isAuthenticated);
      await prisma.story.update({
        where: { id: story.id },
        data: { summary: summary as any },
      });
      console.log(`[Summarize] ✓ ${story.headline.slice(0, 60)}`);
    } catch (err: any) {
      console.warn(`[Summarize] ✗ ${story.headline.slice(0, 40)}: ${err.message}`);
    }
  }

  console.log(`[Summarize] Done — processed ${stories.length} stories.`);
}
