import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// Common RSS feed path patterns to try
const FEED_PATHS = [
  '/feed', '/feed.xml', '/rss', '/rss.xml', '/atom.xml',
  '/feeds/all.atom.xml', '/blog/feed', '/blog/rss',
  '/news/feed', '/index.xml', '/feed/rss', '/feeds',
];

interface DiscoveredFeed {
  url: string;
  title: string;
  type: 'rss' | 'atom' | 'json';
  confidence: 'high' | 'medium';
}

// GET /api/discover?url=https://example.com
router.get('/', async (req: Request, res: Response) => {
  const { url } = req.query as { url: string };
  if (!url) return res.status(400).json({ error: 'url query parameter is required' });

  let normalised = url.trim();
  if (!normalised.startsWith('http')) normalised = `https://${normalised}`;

  const origin = new URL(normalised).origin;
  const feeds: DiscoveredFeed[] = [];

  // 1. Fetch the page HTML and look for <link rel="alternate"> tags
  try {
    const resp = await axios.get(normalised, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (PMIP RSS Discoverer)' },
      maxRedirects: 5,
    });
    const html: string = resp.data;

    // Match <link rel="alternate" type="application/rss+xml" ...>
    const linkRegex = /<link[^>]+rel=["']alternate["'][^>]+>/gi;
    const matches = html.match(linkRegex) || [];

    for (const tag of matches) {
      const typeMatch = tag.match(/type=["']([^"']+)["']/i);
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
      const titleMatch = tag.match(/title=["']([^"']+)["']/i);

      if (!hrefMatch) continue;
      const feedType = typeMatch?.[1] || '';
      if (!feedType.includes('rss') && !feedType.includes('atom') && !feedType.includes('json')) continue;

      let feedUrl = hrefMatch[1];
      if (feedUrl.startsWith('/')) feedUrl = `${origin}${feedUrl}`;
      else if (!feedUrl.startsWith('http')) feedUrl = `${origin}/${feedUrl}`;

      feeds.push({
        url: feedUrl,
        title: titleMatch?.[1] || inferTitle(feedUrl, normalised),
        type: feedType.includes('atom') ? 'atom' : feedType.includes('json') ? 'json' : 'rss',
        confidence: 'high',
      });
    }
  } catch (err: any) {
    console.warn(`[Discover] Failed to fetch ${normalised}: ${err.message}`);
  }

  // 2. Try common feed paths if nothing found from HTML
  if (feeds.length === 0) {
    await Promise.all(FEED_PATHS.map(async (path) => {
      const candidateUrl = `${origin}${path}`;
      try {
        const resp = await axios.get(candidateUrl, {
          timeout: 5000,
          headers: { 'User-Agent': 'Mozilla/5.0 (PMIP RSS Discoverer)' },
          validateStatus: s => s === 200,
        });
        const contentType = resp.headers['content-type'] || '';
        const body: string = resp.data?.toString?.() || '';

        const isRss = contentType.includes('xml') || body.includes('<rss') || body.includes('<feed');
        if (!isRss) return;

        // Extract title from feed
        const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch?.[1]?.trim() || inferTitle(candidateUrl, normalised);

        feeds.push({
          url: candidateUrl,
          title,
          type: body.includes('<feed') ? 'atom' : 'rss',
          confidence: 'medium',
        });
      } catch {}
    }));
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = feeds.filter(f => {
    if (seen.has(f.url)) return false;
    seen.add(f.url);
    return true;
  });

  res.json({ feeds: unique, sourceUrl: normalised });
});

function inferTitle(feedUrl: string, pageUrl: string): string {
  try {
    const host = new URL(pageUrl).hostname.replace('www.', '');
    const path = new URL(feedUrl).pathname;
    if (path.includes('tech')) return `${host} Tech`;
    if (path.includes('business') || path.includes('biz')) return `${host} Business`;
    if (path.includes('world') || path.includes('international')) return `${host} World`;
    if (path.includes('politics')) return `${host} Politics`;
    if (path.includes('science')) return `${host} Science`;
    if (path.includes('health')) return `${host} Health`;
    return host.split('.')[0].charAt(0).toUpperCase() + host.split('.')[0].slice(1);
  } catch {
    return feedUrl;
  }
}

export default router;
