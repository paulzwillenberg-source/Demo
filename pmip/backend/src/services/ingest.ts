import Parser from 'rss-parser';
import { getMockStories } from './mockData';

const parser = new Parser({ timeout: 10000 });

export interface IngestedStory {
  sourceId: string;
  sourceName: string;
  headline: string;
  url: string;
  publishedAt: Date;
  rawText: string;
}

// Default RSS sources from PRD appendix
const DEFAULT_FEEDS: { sourceId: string; name: string; url: string }[] = [
  { sourceId: 'src-nyt-home', name: 'NYT Homepage', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
  { sourceId: 'src-nyt-tech', name: 'NYT Tech', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml' },
  { sourceId: 'src-nyt-biz', name: 'NYT Business', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml' },
  { sourceId: 'src-bloomberg', name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss' },
  { sourceId: 'src-ft', name: 'Financial Times', url: 'https://www.ft.com/rss/home' },
  { sourceId: 'src-verge', name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { sourceId: 'src-wired', name: 'Wired', url: 'https://www.wired.com/feed/rss' },
  { sourceId: 'src-atlantic', name: 'The Atlantic', url: 'https://www.theatlantic.com/feed/all/' },
  { sourceId: 'src-techmeme', name: 'Techmeme', url: 'https://www.techmeme.com/feed.xml' },
];

// Track already-seen URLs in memory (in production, would check DB)
const seenUrls = new Set<string>();

export async function fetchFeed(
  sourceId: string,
  name: string,
  feedUrl: string
): Promise<IngestedStory[]> {
  try {
    const feed = await parser.parseURL(feedUrl);
    const stories: IngestedStory[] = [];

    for (const item of feed.items.slice(0, 20)) {
      const url = item.link || item.guid;
      if (!url || seenUrls.has(url)) continue;
      seenUrls.add(url);

      stories.push({
        sourceId,
        sourceName: name,
        headline: item.title || 'Untitled',
        url,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        rawText: item.contentSnippet || item.content || item.summary || '',
      });
    }
    return stories;
  } catch (err: any) {
    console.warn(`[Ingest] Failed to fetch ${name}: ${err.message}`);
    return [];
  }
}

export async function runIngest(): Promise<void> {
  console.log('[Ingest] Starting ingest run...');
  let total = 0;

  for (const feed of DEFAULT_FEEDS) {
    const stories = await fetchFeed(feed.sourceId, feed.name, feed.url);
    total += stories.length;
    // In production: persist to DB, queue for summarization
  }

  console.log(`[Ingest] Completed. ${total} new stories found.`);
}
