import { subHours, subMinutes } from 'date-fns';

export interface MockSource {
  id: string;
  name: string;
  type: 'WEB' | 'NEWSLETTER' | 'PODCAST';
  category: string;
  isAuthenticated: boolean;
}

export interface MockSummary {
  narrative: string;
  keyPoints: string[];
  whyItMatters: string;
  whatToWatch: string;
}

export interface MockKalshiContract {
  id: string;
  title: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  url: string;
}

export interface MockStory {
  id: string;
  sourceId: string;
  source: MockSource;
  headline: string;
  url: string;
  publishedAt: string;
  summary: MockSummary | null;
  clusterId: string | null;
  clusterLabel: string | null;
  kalshiContracts: MockKalshiContract[] | null;
  isStarred: boolean;
  isRead: boolean;
  isNew: boolean;
  isAuthenticated: boolean;
}

export interface MockCluster {
  id: string;
  label: string;
  velocity: number;
  isHot: boolean;
  storyCount: number;
}

export interface MockBriefing {
  id: string;
  generatedAt: string;
  windowHours: number;
  leadHeadline: string;
  storyCount: number;
  topicCount: number;
  content: {
    leadNarrative: {
      headline: string;
      paragraphs: string[];
      citations: { label: string; url: string }[];
    };
    sections: {
      clusterId: string;
      label: string;
      stories: { headline: string; summary: string; sourceCount: number; url: string }[];
    }[];
  };
}

const now = new Date();

export const MOCK_SOURCES: MockSource[] = [
  { id: 'src-nyt-home', name: 'NYT Homepage', type: 'WEB', category: 'web', isAuthenticated: true },
  { id: 'src-nyt-tech', name: 'NYT Tech', type: 'WEB', category: 'web', isAuthenticated: true },
  { id: 'src-nyt-biz', name: 'NYT Business', type: 'WEB', category: 'web', isAuthenticated: true },
  { id: 'src-bloomberg', name: 'Bloomberg', type: 'WEB', category: 'web', isAuthenticated: true },
  { id: 'src-bloomberg-mkts', name: 'Bloomberg Markets', type: 'WEB', category: 'web', isAuthenticated: true },
  { id: 'src-bloomberg-tech', name: 'Bloomberg Tech', type: 'WEB', category: 'web', isAuthenticated: true },
  { id: 'src-ft', name: 'Financial Times', type: 'WEB', category: 'web', isAuthenticated: true },
  { id: 'src-wsj-tech', name: 'WSJ Tech', type: 'WEB', category: 'web', isAuthenticated: true },
  { id: 'src-wsj-world', name: 'WSJ World', type: 'WEB', category: 'web', isAuthenticated: true },
  { id: 'src-atlantic', name: 'The Atlantic', type: 'WEB', category: 'web', isAuthenticated: false },
  { id: 'src-newyorker', name: 'New Yorker', type: 'WEB', category: 'web', isAuthenticated: false },
  { id: 'src-verge', name: 'The Verge', type: 'WEB', category: 'web', isAuthenticated: false },
  { id: 'src-wired', name: 'Wired', type: 'WEB', category: 'web', isAuthenticated: false },
  { id: 'src-techmeme', name: 'Techmeme', type: 'WEB', category: 'web', isAuthenticated: false },
  { id: 'src-drudge', name: 'Drudge Report', type: 'WEB', category: 'web', isAuthenticated: false },
  { id: 'src-nypost', name: 'NY Post', type: 'WEB', category: 'web', isAuthenticated: false },
  { id: 'src-vanity', name: 'Vanity Fair', type: 'WEB', category: 'web', isAuthenticated: false },
  { id: 'nl-krugman', name: 'Paul Krugman', type: 'NEWSLETTER', category: 'newsletter', isAuthenticated: false },
  { id: 'nl-ezraklein', name: 'Ezra Klein', type: 'NEWSLETTER', category: 'newsletter', isAuthenticated: false },
  { id: 'nl-morningbrew', name: 'Morning Brew', type: 'NEWSLETTER', category: 'newsletter', isAuthenticated: false },
  { id: 'nl-pivot', name: 'Pivot', type: 'NEWSLETTER', category: 'newsletter', isAuthenticated: false },
  { id: 'nl-1440', name: '1440 Daily Digest', type: 'NEWSLETTER', category: 'newsletter', isAuthenticated: false },
  { id: 'pod-tyler', name: 'Conversations with Tyler', type: 'PODCAST', category: 'podcast', isAuthenticated: false },
  { id: 'pod-upfirst', name: 'Up First (NPR)', type: 'PODCAST', category: 'podcast', isAuthenticated: false },
  { id: 'pod-ezra', name: 'The Ezra Klein Show', type: 'PODCAST', category: 'podcast', isAuthenticated: false },
];

export const MOCK_CLUSTERS: MockCluster[] = [
  { id: 'cl-iran', label: 'Iran War', velocity: 4.2, isHot: true, storyCount: 18 },
  { id: 'cl-fed', label: 'Fed Rate Decision', velocity: 3.8, isHot: true, storyCount: 14 },
  { id: 'cl-ai-regulation', label: 'AI Regulation', velocity: 3.1, isHot: true, storyCount: 22 },
  { id: 'cl-trump-tariffs', label: 'Trump Tariffs', velocity: 2.9, isHot: true, storyCount: 19 },
  { id: 'cl-spacex', label: 'SpaceX IPO', velocity: 2.1, isHot: false, storyCount: 8 },
  { id: 'cl-oil', label: 'Oil Prices', velocity: 1.7, isHot: false, storyCount: 11 },
  { id: 'cl-china-tech', label: 'China Tech Crackdown', velocity: 1.5, isHot: false, storyCount: 9 },
  { id: 'cl-banking', label: 'Banking Stress', velocity: 1.2, isHot: false, storyCount: 7 },
];

const makeSummary = (headline: string): MockSummary => ({
  narrative: `${headline} — a development that analysts say could reshape the competitive landscape in the near term. Senior officials familiar with the matter confirmed key details to reporters on condition of anonymity, citing the sensitivity of ongoing deliberations. Markets responded with characteristic uncertainty as traders weighed the implications for the broader macro environment.`,
  keyPoints: [
    'Senior officials confirmed the development in background briefings',
    'Markets moved sharply on the news before stabilising into the close',
    'Analysts at three major banks revised their near-term forecasts',
    'The administration has not yet commented officially',
    'A formal announcement is expected within the next 72 hours',
  ],
  whyItMatters: 'This development sits at the intersection of geopolitical risk and market structure, with potential second-order effects on supply chains, sovereign credit spreads, and the technology sector\'s regulatory environment. It reinforces a pattern that has been building since Q4 of last year.',
  whatToWatch: 'Watch for the official White House response and any reaction from the ECB at Thursday\'s scheduled press conference.',
});

export const MOCK_STORIES: MockStory[] = [
  {
    id: 'st-001', sourceId: 'src-bloomberg', source: MOCK_SOURCES[3],
    headline: 'Fed Signals Pause as Inflation Data Complicates Rate Path',
    url: 'https://bloomberg.com/story/fed-signals-pause',
    publishedAt: subMinutes(now, 12).toISOString(),
    summary: makeSummary('Fed Signals Pause as Inflation Data Complicates Rate Path'),
    clusterId: 'cl-fed', clusterLabel: 'Fed Rate Decision',
    kalshiContracts: [
      { id: 'k1', title: 'Will the Fed cut rates in May 2026?', category: 'ECONOMICS', yesPrice: 0.38, noPrice: 0.62, volume: 485000, url: 'https://kalshi.com/markets/fed-may' },
      { id: 'k2', title: 'Fed funds rate below 4% by June 2026?', category: 'ECONOMICS', yesPrice: 0.61, noPrice: 0.39, volume: 312000, url: 'https://kalshi.com/markets/fed-june' },
    ],
    isStarred: false, isRead: false, isNew: true, isAuthenticated: true,
  },
  {
    id: 'st-002', sourceId: 'src-ft', source: MOCK_SOURCES[6],
    headline: 'Iran Closes Strait of Hormuz to US Vessels After Diplomatic Breakdown',
    url: 'https://ft.com/story/iran-hormuz',
    publishedAt: subMinutes(now, 28).toISOString(),
    summary: makeSummary('Iran Closes Strait of Hormuz to US Vessels After Diplomatic Breakdown'),
    clusterId: 'cl-iran', clusterLabel: 'Iran War',
    kalshiContracts: [
      { id: 'k3', title: 'US military action against Iran before July 2026?', category: 'POLITICS', yesPrice: 0.29, noPrice: 0.71, volume: 920000, url: 'https://kalshi.com/markets/iran-military' },
    ],
    isStarred: true, isRead: false, isNew: true, isAuthenticated: true,
  },
  {
    id: 'st-003', sourceId: 'src-nyt-tech', source: MOCK_SOURCES[1],
    headline: 'Senate AI Committee Advances Sweeping Model Audit Bill',
    url: 'https://nytimes.com/story/senate-ai-bill',
    publishedAt: subMinutes(now, 45).toISOString(),
    summary: makeSummary('Senate AI Committee Advances Sweeping Model Audit Bill'),
    clusterId: 'cl-ai-regulation', clusterLabel: 'AI Regulation',
    kalshiContracts: null,
    isStarred: false, isRead: false, isNew: true, isAuthenticated: true,
  },
  {
    id: 'st-004', sourceId: 'src-wsj-tech', source: MOCK_SOURCES[7],
    headline: 'Trump Signs Executive Order Targeting Chinese Semiconductor Imports',
    url: 'https://wsj.com/story/trump-chips-eo',
    publishedAt: subMinutes(now, 67).toISOString(),
    summary: makeSummary('Trump Signs Executive Order Targeting Chinese Semiconductor Imports'),
    clusterId: 'cl-trump-tariffs', clusterLabel: 'Trump Tariffs',
    kalshiContracts: [
      { id: 'k4', title: 'Additional tariffs on Chinese tech by Q2 2026?', category: 'ECONOMICS', yesPrice: 0.74, noPrice: 0.26, volume: 670000, url: 'https://kalshi.com/markets/china-tariffs' },
    ],
    isStarred: false, isRead: false, isNew: true, isAuthenticated: true,
  },
  {
    id: 'st-005', sourceId: 'src-bloomberg-tech', source: MOCK_SOURCES[5],
    headline: 'SpaceX Files Confidential IPO Documents with SEC, Sources Say',
    url: 'https://bloomberg.com/story/spacex-ipo-sec',
    publishedAt: subMinutes(now, 89).toISOString(),
    summary: makeSummary('SpaceX Files Confidential IPO Documents with SEC, Sources Say'),
    clusterId: 'cl-spacex', clusterLabel: 'SpaceX IPO',
    kalshiContracts: [
      { id: 'k5', title: 'SpaceX IPO before May 31 2026?', category: 'ECONOMICS', yesPrice: 0.36, noPrice: 0.64, volume: 1240000, url: 'https://kalshi.com/markets/spacex-ipo-may' },
      { id: 'k6', title: 'SpaceX IPO before Jun 30 2026?', category: 'ECONOMICS', yesPrice: 0.69, noPrice: 0.31, volume: 890000, url: 'https://kalshi.com/markets/spacex-ipo-jun' },
      { id: 'k7', title: 'SpaceX IPO before Jul 31 2026?', category: 'ECONOMICS', yesPrice: 0.79, noPrice: 0.21, volume: 540000, url: 'https://kalshi.com/markets/spacex-ipo-jul' },
    ],
    isStarred: false, isRead: false, isNew: false, isAuthenticated: true,
  },
  {
    id: 'st-006', sourceId: 'src-verge', source: MOCK_SOURCES[11],
    headline: "OpenAI's New o4 Model Passes Bar Exam with 98th Percentile Score",
    url: 'https://theverge.com/story/openai-o4-bar-exam',
    publishedAt: subMinutes(now, 112).toISOString(),
    summary: makeSummary("OpenAI's New o4 Model Passes Bar Exam with 98th Percentile Score"),
    clusterId: 'cl-ai-regulation', clusterLabel: 'AI Regulation',
    kalshiContracts: null,
    isStarred: false, isRead: true, isNew: false, isAuthenticated: false,
  },
  {
    id: 'st-007', sourceId: 'src-bloomberg-mkts', source: MOCK_SOURCES[4],
    headline: 'Brent Crude Surges 8% as Middle East Tensions Escalate',
    url: 'https://bloomberg.com/story/brent-crude-surge',
    publishedAt: subMinutes(now, 134).toISOString(),
    summary: makeSummary('Brent Crude Surges 8% as Middle East Tensions Escalate'),
    clusterId: 'cl-oil', clusterLabel: 'Oil Prices',
    kalshiContracts: [
      { id: 'k8', title: 'Brent crude above $100 by end of April 2026?', category: 'ECONOMICS', yesPrice: 0.52, noPrice: 0.48, volume: 780000, url: 'https://kalshi.com/markets/brent-100' },
    ],
    isStarred: false, isRead: false, isNew: false, isAuthenticated: true,
  },
  {
    id: 'st-008', sourceId: 'src-nyt-home', source: MOCK_SOURCES[0],
    headline: "White House Weighs Emergency Economic Powers to Counter China's Chip Dominance",
    url: 'https://nytimes.com/story/white-house-china-chips',
    publishedAt: subMinutes(now, 156).toISOString(),
    summary: makeSummary("White House Weighs Emergency Economic Powers to Counter China's Chip Dominance"),
    clusterId: 'cl-china-tech', clusterLabel: 'China Tech Crackdown',
    kalshiContracts: null,
    isStarred: false, isRead: false, isNew: false, isAuthenticated: true,
  },
  {
    id: 'st-009', sourceId: 'src-atlantic', source: MOCK_SOURCES[9],
    headline: 'The Hidden Cost of the AI Productivity Boom',
    url: 'https://theatlantic.com/story/ai-productivity-cost',
    publishedAt: subMinutes(now, 180).toISOString(),
    summary: makeSummary('The Hidden Cost of the AI Productivity Boom'),
    clusterId: 'cl-ai-regulation', clusterLabel: 'AI Regulation',
    kalshiContracts: null,
    isStarred: false, isRead: false, isNew: false, isAuthenticated: false,
  },
  {
    id: 'st-010', sourceId: 'src-wsj-world', source: MOCK_SOURCES[8],
    headline: "Germany's Coalition Collapses Amid Budget Standoff Over Defense Spending",
    url: 'https://wsj.com/story/germany-coalition-collapse',
    publishedAt: subMinutes(now, 205).toISOString(),
    summary: makeSummary("Germany's Coalition Collapses Amid Budget Standoff Over Defense Spending"),
    clusterId: null, clusterLabel: null,
    kalshiContracts: null,
    isStarred: false, isRead: false, isNew: false, isAuthenticated: true,
  },
  {
    id: 'st-011', sourceId: 'src-ft', source: MOCK_SOURCES[6],
    headline: 'ECB Holds Rates as Euro Zone Inflation Remains Sticky',
    url: 'https://ft.com/story/ecb-rates-hold',
    publishedAt: subMinutes(now, 225).toISOString(),
    summary: makeSummary('ECB Holds Rates as Euro Zone Inflation Remains Sticky'),
    clusterId: 'cl-fed', clusterLabel: 'Fed Rate Decision',
    kalshiContracts: null,
    isStarred: false, isRead: false, isNew: false, isAuthenticated: true,
  },
  {
    id: 'st-012', sourceId: 'src-wired', source: MOCK_SOURCES[12],
    headline: "Anthropic's New Constitutional AI 2.0 Framework Sets New Safety Standard",
    url: 'https://wired.com/story/anthropic-constitutional-ai-2',
    publishedAt: subMinutes(now, 248).toISOString(),
    summary: makeSummary("Anthropic's New Constitutional AI 2.0 Framework Sets New Safety Standard"),
    clusterId: 'cl-ai-regulation', clusterLabel: 'AI Regulation',
    kalshiContracts: null,
    isStarred: false, isRead: true, isNew: false, isAuthenticated: false,
  },
  {
    id: 'st-013', sourceId: 'src-bloomberg', source: MOCK_SOURCES[3],
    headline: 'Goldman Sachs Raises S&P 500 Target to 6,200 on Earnings Resilience',
    url: 'https://bloomberg.com/story/goldman-sp-target',
    publishedAt: subMinutes(now, 270).toISOString(),
    summary: makeSummary('Goldman Sachs Raises S&P 500 Target to 6,200 on Earnings Resilience'),
    clusterId: 'cl-banking', clusterLabel: 'Banking Stress',
    kalshiContracts: null,
    isStarred: false, isRead: false, isNew: false, isAuthenticated: true,
  },
  {
    id: 'st-014', sourceId: 'src-techmeme', source: MOCK_SOURCES[13],
    headline: "Apple Acquires AI Startup Playground for $1.4B to Bolster On-Device Models",
    url: 'https://techmeme.com/story/apple-playground-acquisition',
    publishedAt: subMinutes(now, 295).toISOString(),
    summary: makeSummary("Apple Acquires AI Startup Playground for $1.4B to Bolster On-Device Models"),
    clusterId: 'cl-ai-regulation', clusterLabel: 'AI Regulation',
    kalshiContracts: null,
    isStarred: false, isRead: false, isNew: false, isAuthenticated: false,
  },
  {
    id: 'st-015', sourceId: 'src-nyt-biz', source: MOCK_SOURCES[2],
    headline: 'Amazon Warehouse Workers Vote to Unionize in Historic Nevada Ballot',
    url: 'https://nytimes.com/story/amazon-union-nevada',
    publishedAt: subHours(now, 5).toISOString(),
    summary: makeSummary('Amazon Warehouse Workers Vote to Unionize in Historic Nevada Ballot'),
    clusterId: null, clusterLabel: null,
    kalshiContracts: null,
    isStarred: false, isRead: false, isNew: false, isAuthenticated: true,
  },
  {
    id: 'st-016', sourceId: 'nl-krugman', source: MOCK_SOURCES[17],
    headline: 'Newsletter: The Tariff Trap — Why Protection Always Costs More Than Promised',
    url: 'https://paulkrugman.substack.com/p/the-tariff-trap',
    publishedAt: subHours(now, 6).toISOString(),
    summary: makeSummary('Newsletter: The Tariff Trap — Why Protection Always Costs More Than Promised'),
    clusterId: 'cl-trump-tariffs', clusterLabel: 'Trump Tariffs',
    kalshiContracts: null,
    isStarred: false, isRead: false, isNew: false, isAuthenticated: false,
  },
  {
    id: 'st-017', sourceId: 'nl-pivot', source: MOCK_SOURCES[20],
    headline: 'Newsletter: Pivot — Is the Big Tech Antitrust Wave Finally Breaking?',
    url: 'https://pivot.fm/big-tech-antitrust',
    publishedAt: subHours(now, 7).toISOString(),
    summary: makeSummary('Newsletter: Pivot — Is the Big Tech Antitrust Wave Finally Breaking?'),
    clusterId: 'cl-ai-regulation', clusterLabel: 'AI Regulation',
    kalshiContracts: null,
    isStarred: false, isRead: false, isNew: false, isAuthenticated: false,
  },
  {
    id: 'st-018', sourceId: 'src-nypost', source: MOCK_SOURCES[15],
    headline: 'Oil Executives Warn of $130 Crude if Iran Conflict Widens',
    url: 'https://nypost.com/story/oil-130-iran',
    publishedAt: subHours(now, 8).toISOString(),
    summary: makeSummary('Oil Executives Warn of $130 Crude if Iran Conflict Widens'),
    clusterId: 'cl-oil', clusterLabel: 'Oil Prices',
    kalshiContracts: null,
    isStarred: false, isRead: true, isNew: false, isAuthenticated: false,
  },
  {
    id: 'st-019', sourceId: 'src-newyorker', source: MOCK_SOURCES[10],
    headline: "The Last Editor: How AI is Rewriting Publishing's Power Structure",
    url: 'https://newyorker.com/story/last-editor',
    publishedAt: subHours(now, 9).toISOString(),
    summary: makeSummary("The Last Editor: How AI is Rewriting Publishing's Power Structure"),
    clusterId: 'cl-ai-regulation', clusterLabel: 'AI Regulation',
    kalshiContracts: null,
    isStarred: false, isRead: false, isNew: false, isAuthenticated: false,
  },
  {
    id: 'st-020', sourceId: 'src-bloomberg', source: MOCK_SOURCES[3],
    headline: 'China Retaliates with Rare Earth Export Restrictions Targeting US Defense',
    url: 'https://bloomberg.com/story/china-rare-earth-restrictions',
    publishedAt: subHours(now, 10).toISOString(),
    summary: makeSummary('China Retaliates with Rare Earth Export Restrictions Targeting US Defense'),
    clusterId: 'cl-china-tech', clusterLabel: 'China Tech Crackdown',
    kalshiContracts: [
      { id: 'k9', title: 'China rare earth export ban expanded before June 2026?', category: 'POLITICS', yesPrice: 0.45, noPrice: 0.55, volume: 290000, url: 'https://kalshi.com/markets/china-rare-earth' },
    ],
    isStarred: false, isRead: false, isNew: false, isAuthenticated: true,
  },
];

export function getMockStories(): MockStory[] {
  return MOCK_STORIES;
}

export function getMockStoryById(id: string): MockStory | undefined {
  return MOCK_STORIES.find(s => s.id === id);
}

export function getMockClusters(): MockCluster[] {
  return MOCK_CLUSTERS;
}

export function getMockSources(): MockSource[] {
  return MOCK_SOURCES;
}

export function getMockBriefing(): MockBriefing {
  return {
    id: 'briefing-001',
    generatedAt: subMinutes(now, 5).toISOString(),
    windowHours: 6,
    leadHeadline: 'Iran Closes Strait of Hormuz as Fed Signals Rate Pause; Markets in Crisis Mode',
    storyCount: 87,
    topicCount: 12,
    content: {
      leadNarrative: {
        headline: 'Iran Closes Strait of Hormuz as Fed Signals Rate Pause; Markets in Crisis Mode',
        paragraphs: [
          "Iran's closure of the Strait of Hormuz to US naval vessels, announced in the early hours of Sunday morning, has triggered the most significant market dislocation since the 2022 energy crisis. Brent crude surged 8.4% to $107.20 in overnight trading, while the dollar index climbed to a six-month high as investors fled to safe-haven assets. The move, which Tehran framed as a \"temporary defensive measure\" in response to last week's Treasury sanctions, effectively blocks transit for approximately 21 million barrels of daily oil flow — roughly a fifth of global supply.",
          "Against this backdrop, the Federal Reserve's Friday signals of a prolonged rate pause have taken on new complexity. Fed officials had telegraphed patience in the face of sticky services inflation; the Iran shock now introduces an entirely different inflationary pressure through energy costs, complicating both the near-term policy path and the political calculus heading into mid-term positioning. The White House has convened an emergency NSC meeting; a statement is expected before Asian markets open Monday.",
        ],
        citations: [
          { label: 'Financial Times', url: 'https://ft.com/story/iran-hormuz' },
          { label: 'Bloomberg Markets', url: 'https://bloomberg.com/story/brent-crude-surge' },
          { label: 'Bloomberg', url: 'https://bloomberg.com/story/fed-signals-pause' },
        ],
      },
      sections: [
        {
          clusterId: 'cl-ai-regulation',
          label: 'AI Regulation',
          stories: [
            { headline: 'Senate AI Committee Advances Sweeping Model Audit Bill', summary: 'Bipartisan legislation would require third-party audits of AI models above a compute threshold, with penalties up to 4% of global revenue.', sourceCount: 6, url: 'https://nytimes.com/story/senate-ai-bill' },
            { headline: "OpenAI's New o4 Model Passes Bar Exam with 98th Percentile Score", summary: 'The result reignites debate over AI in professional licensing, with the ABA calling for an emergency review.', sourceCount: 4, url: 'https://theverge.com/story/openai-o4-bar-exam' },
            { headline: "Apple Acquires AI Startup Playground for $1.4B", summary: 'The deal signals Apple\'s pivot toward on-device AI inference, reducing dependency on cloud-based model providers.', sourceCount: 3, url: 'https://techmeme.com/story/apple-playground-acquisition' },
          ],
        },
        {
          clusterId: 'cl-trump-tariffs',
          label: 'Trump Tariffs',
          stories: [
            { headline: 'Trump Signs Executive Order Targeting Chinese Semiconductor Imports', summary: '25% tariff on advanced chips and chipmaking equipment from Chinese entities, effective in 30 days with limited exemptions.', sourceCount: 7, url: 'https://wsj.com/story/trump-chips-eo' },
            { headline: 'The Tariff Trap — Krugman Newsletter', summary: 'Krugman argues the net welfare cost of the current tariff regime now exceeds $340B annually in consumer surplus losses.', sourceCount: 1, url: 'https://paulkrugman.substack.com/p/the-tariff-trap' },
          ],
        },
        {
          clusterId: 'cl-spacex',
          label: 'SpaceX IPO',
          stories: [
            { headline: 'SpaceX Files Confidential IPO Documents with SEC, Sources Say', summary: 'The confidential S-1 filing suggests a potential valuation above $250B, which would make it the largest US tech IPO in a decade.', sourceCount: 5, url: 'https://bloomberg.com/story/spacex-ipo-sec' },
          ],
        },
        {
          clusterId: 'cl-banking',
          label: 'Banking Stress',
          stories: [
            { headline: 'Goldman Sachs Raises S&P 500 Target to 6,200 on Earnings Resilience', summary: 'Goldman cites better-than-expected Q1 earnings from 71% of S&P constituents, though flagged the Iran risk as a significant tail.', sourceCount: 3, url: 'https://bloomberg.com/story/goldman-sp-target' },
          ],
        },
      ],
    },
  };
}
