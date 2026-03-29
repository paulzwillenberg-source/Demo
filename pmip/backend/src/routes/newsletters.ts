import { Router, Request, Response } from 'express';
import { getMockStories } from '../services/mockData';

const router = Router();

// GET /api/newsletters
router.get('/', (_req: Request, res: Response) => {
  const { limit = '30', offset = '0' } = _req.query as Record<string, string>;
  const all = getMockStories().filter(s => s.source.type === 'NEWSLETTER');
  const offsetN = parseInt(offset);
  const limitN = parseInt(limit);
  res.json({ stories: all.slice(offsetN, offsetN + limitN), total: all.length });
});

// GET /api/newsletters/:id
router.get('/:id', (req: Request, res: Response) => {
  const story = getMockStories().find(s => s.id === req.params.id && s.source.type === 'NEWSLETTER');
  if (!story) return res.status(404).json({ error: 'Newsletter not found' });
  res.json(story);
});

export default router;
