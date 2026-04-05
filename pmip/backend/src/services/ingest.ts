import Parser from 'rss-parser';
import { prisma, isDatabaseConfigured } from '../lib/prisma';

const parser = new Parser({ timeout: 10000 });

const DEFAULT_FEEDS = [
  { name: 'NYT Homepage',     type: 'WEB' as const, category: 'web', feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
  { name: 'NYT Tech',         type: 'WEB' as const, category: 'web', feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml' },
  { name: 'NYT Business',     type: 'WEB' as const, category: 'web', feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml' },
  { name: 'Bloomberg',        type: 'WEB' as const, category: 'web', feedUrl: 'https://feeds.bloomberg.com/markets/news.rss' },
  { name: 'The Verge',        type: 'WEB' as const, category: 'web', feedUrl: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Wired',            type: 'WEB' as const, category: 'web', feedUrl: 'https://www.wired.com/feed/rss' },
  { name: 'The Atlantic',     type: 'WEB' as const, category: 'web', feedUrl: 'https://www.theatlantic.com/feed/all/' },
  { name: 'Techmeme',         type: 'WEB' as const, category: 'web', feedUrl: 'https://www.techmeme.com/feed.xml' },
  { name: 'Financial Times',  type: 'WEB' as const, category: 'web', feedUrl: 'https://www.ft.com/rss/home' },
];

export async function runIngest(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.log('[Ingest] No database configured — skipping live ingest, using mock data');
    return;
  }

  console.log('[Ingest] Starting ingest run...');

  // Fetch all active sources from DB
  const sources = await prisma.source.findMany({ where: { isActive: true, type: 'WEB' } });
  let total = 0;

  for (const source of sources) {
    if (!source.feedUrl) continue;
    try {
      const feed = await parser.parseURL(source.feedUrl);
      for (const item of feed.items.slice(0, 20)) {
        const url = item.link || item.guid;
        if (!url) continue;

        // Upsert — skip if URL already exists
        const existing = await prisma.story.findUnique({ where: { url } });
        if (existing) continue;

        await prisma.story.create({
          data: {
            sourceId: source.id,
            headline: item.title || 'Untitled',
            url,
            publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            fullText: item.content || item.contentSnippet || item.summary || null,
          },
        });
        total++;
      }
    } catch (err: any) {
      console.warn(`[Ingest] Failed to fetch ${source.name}: ${err.message}`);
    }
  }

  console.log(`[Ingest] Completed. ${total} new stories saved.`);
}
