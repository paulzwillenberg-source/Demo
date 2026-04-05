import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Called by the store to inject/clear the auth token
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

// 401 interceptor — clears token so the login screen appears
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/')) {
      setAuthToken(null);
      // Force page reload to show login screen
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

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
  fullText: string | null;
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
