import { Router, Request, Response } from 'express';
import { getContractsForStory } from '../services/kalshi';
import { getMockStoryById } from '../services/mockData';

const router = Router();

// GET /api/kalshi/contracts/:storyId
router.get('/contracts/:storyId', async (req: Request, res: Response) => {
  const story = getMockStoryById(req.params.storyId);
  if (!story) return res.status(404).json({ error: 'Story not found' });

  try {
    const contracts = await getContractsForStory(story.headline, story.clusterLabel || null);
    res.json({ contracts });
  } catch (err: any) {
    console.error('[Kalshi] contract lookup failed:', err.message);
    res.json({ contracts: story.kalshiContracts || [] });
  }
});

export default router;
