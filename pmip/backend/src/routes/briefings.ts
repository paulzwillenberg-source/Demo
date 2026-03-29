import { Router, Request, Response } from 'express';
import { generateBriefing } from '../services/briefing';
import { getMockBriefing } from '../services/mockData';

const router = Router();

let latestBriefing: any = null;
let generating = false;

// GET /api/briefings/latest
router.get('/latest', async (_req: Request, res: Response) => {
  if (latestBriefing) return res.json(latestBriefing);
  // Return mock briefing on first load
  res.json(getMockBriefing());
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
    latestBriefing = briefing;
    res.json(briefing);
  } catch (err: any) {
    console.error('[Briefing] generation failed:', err.message);
    // Fall back to mock
    const mock = getMockBriefing();
    latestBriefing = mock;
    res.json(mock);
  } finally {
    generating = false;
  }
});

export default router;
