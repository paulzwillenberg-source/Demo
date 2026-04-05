import { prisma, isDatabaseConfigured } from '../lib/prisma';
import { getMockStories, getMockBriefing } from './mockData';
import { generateBriefingContent } from './summarize';
import { sendBriefingEmail } from './email';
import { config } from '../config';
import { subHours } from 'date-fns';

export interface BriefingResult {
  id: string;
  generatedAt: string;
  windowHours: number;
  leadHeadline: string;
  storyCount: number;
  topicCount: number;
  content: any;
}

export async function generateBriefing(windowHours: number = 6): Promise<BriefingResult> {
  const cutoff = subHours(new Date(), windowHours);

  // Get recent stories
  let storyInputs: { headline: string; summary: string; source: string; url: string; clusterLabel: string | null }[] = [];

  if (isDatabaseConfigured()) {
    const stories = await prisma.story.findMany({
      where: {
        publishedAt: { gte: cutoff },
        summary: { not: null },
      },
      include: { source: true, cluster: true },
      orderBy: { publishedAt: 'desc' },
      take: 100,
    });

    storyInputs = stories.map(s => ({
      headline: s.headline,
      summary: (s.summary as any)?.narrative || '',
      source: s.source.name,
      url: s.url,
      clusterLabel: s.cluster?.label ?? null,
    }));
  } else {
    const mockStories = getMockStories().filter(
      s => new Date(s.publishedAt) >= cutoff && s.summary
    );
    storyInputs = mockStories.map(s => ({
      headline: s.headline,
      summary: s.summary?.narrative || '',
      source: s.source.name,
      url: s.url,
      clusterLabel: s.clusterLabel,
    }));
  }

  if (storyInputs.length === 0 || !config.anthropicApiKey) {
    const mock = getMockBriefing();
    return { ...mock, windowHours };
  }

  const aiContent = await generateBriefingContent(storyInputs, windowHours);

  const result: BriefingResult = {
    id: `briefing-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    windowHours,
    leadHeadline: aiContent.leadHeadline || 'Macro Briefing',
    storyCount: storyInputs.length,
    topicCount: aiContent.sections?.length || 0,
    content: aiContent,
  };

  if (config.resendApiKey && config.briefingEmail) {
    sendBriefingEmail(result).catch(err =>
      console.error('[Briefing] Email delivery failed:', err.message)
    );
  }

  return result;
}
