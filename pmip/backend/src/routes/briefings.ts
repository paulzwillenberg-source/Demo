import { Router, Request, Response } from 'express';
import { prisma, isDatabaseConfigured } from '../lib/prisma';
import { generateBriefing } from '../services/briefing';
import { getMockBriefing } from '../services/mockData';

const router = Router();
let generating = false;

// GET /api/briefings/latest
router.get('/latest', async (_req: Request, res: Response) => {
  if (!isDatabaseConfigured()) {
    return res.json(getMockBriefing());
  }

  const briefing = await prisma.briefing.findFirst({
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

export default router;
