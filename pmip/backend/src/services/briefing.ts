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
  const allStories = getMockStories();

  const recent = allStories.filter(
    s => new Date(s.publishedAt) >= cutoff && s.summary
  );

  if (recent.length === 0 || !config.anthropicApiKey) {
    // Fall back to mock briefing
    const mock = getMockBriefing();
    return { ...mock, windowHours };
  }

  const storyInputs = recent.map(s => ({
    headline: s.headline,
    summary: s.summary?.narrative || '',
    source: s.source.name,
    url: s.url,
    clusterLabel: s.clusterLabel,
  }));

  const aiContent = await generateBriefingContent(storyInputs, windowHours);

  const result: BriefingResult = {
    id: `briefing-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    windowHours,
    leadHeadline: aiContent.leadHeadline || 'Macro Briefing',
    storyCount: recent.length,
    topicCount: aiContent.sections?.length || 0,
    content: aiContent,
  };

  // Fire-and-forget email delivery
  if (config.resendApiKey && config.briefingEmail) {
    sendBriefingEmail(result).catch(err =>
      console.error('[Briefing] Email delivery failed:', err.message)
    );
  }

  return result;
}
