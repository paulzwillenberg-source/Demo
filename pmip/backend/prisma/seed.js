const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SOURCES = [
  // Web — Authenticated
  { name: 'NYT Homepage',        type: 'WEB', category: 'web', feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',    isAuthenticated: true },
  { name: 'NYT Tech',            type: 'WEB', category: 'web', feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',  isAuthenticated: true },
  { name: 'NYT Business',        type: 'WEB', category: 'web', feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',    isAuthenticated: true },
  { name: 'Bloomberg',           type: 'WEB', category: 'web', feedUrl: 'https://feeds.bloomberg.com/markets/news.rss',                 isAuthenticated: true },
  { name: 'Bloomberg Markets',   type: 'WEB', category: 'web', feedUrl: 'https://feeds.bloomberg.com/bview/news.rss',                   isAuthenticated: true },
  { name: 'Bloomberg Tech',      type: 'WEB', category: 'web', feedUrl: 'https://feeds.bloomberg.com/technology/news.rss',              isAuthenticated: true },
  { name: 'Financial Times',     type: 'WEB', category: 'web', feedUrl: 'https://www.ft.com/rss/home',                                 isAuthenticated: true },
  { name: 'FT World',            type: 'WEB', category: 'web', feedUrl: 'https://www.ft.com/rss/home/world',                           isAuthenticated: true },
  { name: 'WSJ Tech',            type: 'WEB', category: 'web', feedUrl: 'https://feeds.a.dj.com/rss/RSSWSJD.xml',                      isAuthenticated: true },
  { name: 'WSJ World',           type: 'WEB', category: 'web', feedUrl: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',                 isAuthenticated: true },
  // Web — Open
  { name: 'The Atlantic',        type: 'WEB', category: 'web', feedUrl: 'https://www.theatlantic.com/feed/all/',                       isAuthenticated: false },
  { name: 'New Yorker',          type: 'WEB', category: 'web', feedUrl: 'https://www.newyorker.com/feed/everything',                   isAuthenticated: false },
  { name: 'New York Magazine',   type: 'WEB', category: 'web', feedUrl: 'https://nymag.com/feed/articles/all/rss.xml',                 isAuthenticated: false },
  { name: 'Vanity Fair',         type: 'WEB', category: 'web', feedUrl: 'https://www.vanityfair.com/feed/rss',                         isAuthenticated: false },
  { name: 'Techmeme',            type: 'WEB', category: 'web', feedUrl: 'https://www.techmeme.com/feed.xml',                           isAuthenticated: false },
  { name: 'Mediagazer',          type: 'WEB', category: 'web', feedUrl: 'https://www.mediagazer.com/feed.xml',                         isAuthenticated: false },
  { name: 'Drudge Report',       type: 'WEB', category: 'web', feedUrl: 'https://feeds.feedburner.com/DrudgeReportFeed',               isAuthenticated: false },
  { name: 'NY Post',             type: 'WEB', category: 'web', feedUrl: 'https://nypost.com/feed/',                                    isAuthenticated: false },
  { name: 'Page Six',            type: 'WEB', category: 'web', feedUrl: 'https://pagesix.com/feed/',                                   isAuthenticated: false },
  { name: 'The Verge',           type: 'WEB', category: 'web', feedUrl: 'https://www.theverge.com/rss/index.xml',                      isAuthenticated: false },
  { name: 'Wired',               type: 'WEB', category: 'web', feedUrl: 'https://www.wired.com/feed/rss',                              isAuthenticated: false },
  // Newsletters
  { name: 'Paul Krugman',        type: 'NEWSLETTER', category: 'newsletter', feedUrl: 'newsletters@paulkrugman.substack.com',          isAuthenticated: false },
  { name: 'Ezra Klein',          type: 'NEWSLETTER', category: 'newsletter', feedUrl: 'ezraklein@nytimes.com',                         isAuthenticated: false },
  { name: 'Pivot',               type: 'NEWSLETTER', category: 'newsletter', feedUrl: 'kara@pivot.fm',                                 isAuthenticated: false },
  { name: 'Morning Brew',        type: 'NEWSLETTER', category: 'newsletter', feedUrl: 'hello@morningbrew.com',                         isAuthenticated: false },
  { name: 'TLDR',                type: 'NEWSLETTER', category: 'newsletter', feedUrl: 'hello@tldr.tech',                               isAuthenticated: false },
  { name: 'The Hustle',          type: 'NEWSLETTER', category: 'newsletter', feedUrl: 'hello@thehustle.co',                            isAuthenticated: false },
  { name: '1440 Daily Digest',   type: 'NEWSLETTER', category: 'newsletter', feedUrl: '1440digest@join1440.com',                       isAuthenticated: false },
  { name: 'Derek Thompson',      type: 'NEWSLETTER', category: 'newsletter', feedUrl: 'derek@theatlantic.com',                         isAuthenticated: false },
  // Podcasts
  { name: 'Conversations with Tyler', type: 'PODCAST', category: 'podcast', feedUrl: 'https://feeds.simplecast.com/dHoohVNH',         isAuthenticated: false },
  { name: 'Up First (NPR)',      type: 'PODCAST', category: 'podcast', feedUrl: 'https://feeds.npr.org/510318/podcast.xml',            isAuthenticated: false },
  { name: 'Plain English',       type: 'PODCAST', category: 'podcast', feedUrl: 'https://feeds.megaphone.fm/ADL9840290619',            isAuthenticated: false },
  { name: 'The Ezra Klein Show', type: 'PODCAST', category: 'podcast', feedUrl: 'https://feeds.simplecast.com/82FI35Px',              isAuthenticated: false },
  { name: 'Pivot Podcast',       type: 'PODCAST', category: 'podcast', feedUrl: 'https://feeds.megaphone.fm/pivot',                   isAuthenticated: false },
];

async function main() {
  console.log('Seeding sources...');
  for (const source of SOURCES) {
    const id = source.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await prisma.source.upsert({
      where: { id },
      update: {},
      create: { id, ...source },
    });
  }
  console.log(`✅ Seeded ${SOURCES.length} sources.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
