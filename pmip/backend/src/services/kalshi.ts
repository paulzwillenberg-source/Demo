import axios from 'axios';
import { config } from '../config';

const KALSHI_BASE = 'https://trading-api.kalshi.com/trade-api/v2';

interface KalshiContract {
  id: string;
  title: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  url: string;
}

// TTL cache: key -> { data, expiresAt }
const cache = new Map<string, { data: KalshiContract[]; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function getContractsForStory(
  headline: string,
  clusterLabel: string | null
): Promise<KalshiContract[]> {
  const cacheKey = clusterLabel || headline.slice(0, 50);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  if (!config.kalshiApiKey) {
    return getMockContracts(headline, clusterLabel);
  }

  try {
    const query = clusterLabel || extractKeyTerms(headline);
    const resp = await axios.get(`${KALSHI_BASE}/markets`, {
      headers: { Authorization: `Bearer ${config.kalshiApiKey}` },
      params: { search: query, status: 'open', limit: 5 },
      timeout: 5000,
    });

    const contracts: KalshiContract[] = (resp.data.markets || []).map((m: any) => ({
      id: m.ticker,
      title: m.title,
      category: m.category || 'GENERAL',
      yesPrice: Math.round((m.yes_bid || 0.5) * 100) / 100,
      noPrice: Math.round((1 - (m.yes_bid || 0.5)) * 100) / 100,
      volume: m.volume || 0,
      url: `https://kalshi.com/markets/${m.ticker}`,
    }));

    cache.set(cacheKey, { data: contracts, expiresAt: Date.now() + CACHE_TTL_MS });
    return contracts;
  } catch (err: any) {
    console.warn('[Kalshi] API error:', err.message);
    return [];
  }
}

function extractKeyTerms(headline: string): string {
  // Remove common stop words, return first 3-4 significant words
  const stop = new Set(['the', 'a', 'an', 'as', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'and', 'or', 'by', 'is', 'are', 'was', 'were']);
  return headline
    .split(/\s+/)
    .filter(w => w.length > 3 && !stop.has(w.toLowerCase()))
    .slice(0, 4)
    .join(' ');
}

function getMockContracts(headline: string, clusterLabel: string | null): KalshiContract[] {
  const lower = (headline + ' ' + (clusterLabel || '')).toLowerCase();

  if (lower.includes('spacex') || lower.includes('ipo')) {
    return [
      { id: 'SPACEX-IPO-MAY26', title: 'SpaceX IPO before May 31 2026?', category: 'ECONOMICS', yesPrice: 0.36, noPrice: 0.64, volume: 1240000, url: 'https://kalshi.com/markets/spacex-ipo' },
      { id: 'SPACEX-IPO-JUN26', title: 'SpaceX IPO before Jun 30 2026?', category: 'ECONOMICS', yesPrice: 0.69, noPrice: 0.31, volume: 890000, url: 'https://kalshi.com/markets/spacex-ipo-jun' },
    ];
  }
  if (lower.includes('fed') || lower.includes('rate') || lower.includes('inflation')) {
    return [
      { id: 'FED-CUT-MAY26', title: 'Will the Fed cut rates in May 2026?', category: 'ECONOMICS', yesPrice: 0.38, noPrice: 0.62, volume: 485000, url: 'https://kalshi.com/markets/fed-may-cut' },
    ];
  }
  if (lower.includes('iran') || lower.includes('hormuz')) {
    return [
      { id: 'IRAN-MIL-JUL26', title: 'US military action against Iran before July 2026?', category: 'POLITICS', yesPrice: 0.29, noPrice: 0.71, volume: 920000, url: 'https://kalshi.com/markets/iran-mil' },
    ];
  }
  if (lower.includes('trump') || lower.includes('tariff')) {
    return [
      { id: 'TARIFF-Q2-26', title: 'Additional tariffs on China by Q2 2026?', category: 'ECONOMICS', yesPrice: 0.74, noPrice: 0.26, volume: 670000, url: 'https://kalshi.com/markets/tariff-q2' },
    ];
  }
  if (lower.includes('oil') || lower.includes('crude') || lower.includes('brent')) {
    return [
      { id: 'BRENT-100-APR26', title: 'Brent crude above $100 by end of April 2026?', category: 'ECONOMICS', yesPrice: 0.52, noPrice: 0.48, volume: 780000, url: 'https://kalshi.com/markets/brent-100' },
    ];
  }
  return [];
}
