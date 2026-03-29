import axios from 'axios';

const SESSION_TOKEN = import.meta.env.VITE_SESSION_TOKEN || 'dev-token';

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'x-session-token': SESSION_TOKEN,
  },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KalshiContract {
  id: string;
  title: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  url: string;
}

export interface StorySummary {
  narrative: string;
  keyPoints: string[];
  whyItMatters: string;
  whatToWatch: string;
}

export interface Source {
  id: string;
  name: string;
  type: 'WEB' | 'NEWSLETTER' | 'PODCAST';
  category: string;
  isAuthenticated: boolean;
}

export interface Story {
  id: string;
  sourceId: string;
  source: Source;
  headline: string;
  url: string;
  publishedAt: string;
  summary: StorySummary | null;
  clusterId: string | null;
  clusterLabel: string | null;
  kalshiContracts: KalshiContract[] | null;
  isStarred: boolean;
  isRead: boolean;
  isNew: boolean;
  isAuthenticated: boolean;
}

export interface Cluster {
  id: string;
  label: string;
  velocity: number;
  isHot: boolean;
  storyCount: number;
}

export interface BriefingSection {
  clusterId: string;
  label: string;
  stories: { headline: string; summary: string; sourceCount: number; url: string }[];
}

export interface Briefing {
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
    sections: BriefingSection[];
  };
}

// ─── API functions ─────────────────────────────────────────────────────────────

export async function fetchStories(params?: {
  clusterId?: string;
  starred?: boolean;
  source?: string;
  limit?: number;
  offset?: number;
}): Promise<{ stories: Story[]; total: number }> {
  const { data } = await api.get('/stories', { params });
  return data;
}

export async function fetchStory(id: string): Promise<Story> {
  const { data } = await api.get(`/stories/${id}`);
  return data;
}

export async function toggleStar(id: string): Promise<{ isStarred: boolean }> {
  const { data } = await api.post(`/stories/${id}/star`);
  return data;
}

export async function markRead(id: string): Promise<void> {
  await api.post(`/stories/${id}/read`);
}

export async function fetchClusters(): Promise<{ clusters: Cluster[] }> {
  const { data } = await api.get('/clusters');
  return data;
}

export async function fetchLatestBriefing(): Promise<Briefing> {
  const { data } = await api.get('/briefings/latest');
  return data;
}

export async function generateBriefing(windowHours: number = 6): Promise<Briefing> {
  const { data } = await api.post('/briefings/generate', { windowHours });
  return data;
}

export async function fetchSources(): Promise<{ sources: Source[] }> {
  const { data } = await api.get('/sources');
  return data;
}

export async function fetchNewsletters(params?: { limit?: number; offset?: number }): Promise<{ stories: Story[]; total: number }> {
  const { data } = await api.get('/newsletters', { params });
  return data;
}
