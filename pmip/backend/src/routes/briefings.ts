import { Router, Request, Response } from 'express';
import { prisma, isDatabaseConfigured } from '../lib/prisma';
import { generateBriefing } from '../services/briefing';
import { getMockBriefing } from '../services/mockData';
import { summarizeStory } from '../services/summarize';

const router = Router();
let generating = false;

// GET /api/briefings/latest
router.get('/latest', async (req: Request, res: Response) => {
  if (!isDatabaseConfigured()) {
    return res.json(getMockBriefing());
  }

  const userId = req.user!.id;
  const briefing = await prisma.briefing.findFirst({
    where: { OR: [{ userId }, { userId: null }] },
    orderBy: { generatedAt: 'desc' },
  });
  if (!briefing) return res.json(getMockBriefing());
  res.json(briefing);
});

// POST /api/briefings/generate
router.post('/generate', async (req: Request, res: Response) => {
  if (generating) {
    return res.status(409).json({ error: 'Briefing generation already in progress' });
  }
  generating = true;
  try {
    const windowHours = parseInt(req.body?.windowHours || '6');
    const briefing = await generateBriefing(windowHours);

    if (isDatabaseConfigured()) {
      await prisma.briefing.create({
        data: {
          leadHeadline: briefing.leadHeadline,
          windowHours: briefing.windowHours,
          content: briefing.content as any,
          storyCount: briefing.storyCount,
          topicCount: briefing.topicCount,
          userId: req.user?.id ?? null,
        },
      });
    }

    res.json(briefing);
  } catch (err: any) {
    console.error('[Briefing] generation failed:', err.message);
    res.json(getMockBriefing());
  } finally {
    generating = false;
  }
});

// POST /api/briefings/summarize-backfill
// Summarizes up to `limit` stories that have no summary yet
router.post('/summarize-backfill', async (req: Request, res: Response) => {
  if (!isDatabaseConfigured()) return res.json({ done: 0 });

  const limit = parseInt(req.body?.limit || '20');
  const stories = await prisma.story.findMany({
    where: { summary: null, fullText: { not: null } },
    include: { source: true },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });

  // Fire and forget — respond immediately
  res.json({ queued: stories.length });

  for (const story of stories) {
    try {
      const text = story.fullText || story.headline;
      const summary = await summarizeStory(text, story.headline, story.source.isAuthenticated);
      await prisma.story.update({ where: { id: story.id }, data: { summary: summary as any } });
      console.log(`[Backfill] ✓ ${story.headline.slice(0, 60)}`);
    } catch (err: any) {
      console.warn(`[Backfill] ✗ ${story.headline.slice(0, 40)}: ${err.message}`);
    }
  }
});

export default router;
