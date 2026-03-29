import { Router, Request, Response } from 'express';
import { getMockStories, getMockStoryById } from '../services/mockData';

const router = Router();

// In-memory starred/read state (would use Prisma in production)
const starredIds = new Set<string>();
const readIds = new Set<string>();

// GET /api/stories
router.get('/', (_req: Request, res: Response) => {
  const { clusterId, starred, source, limit = '50', offset = '0' } = _req.query as Record<string, string>;
  let stories = getMockStories();

  if (clusterId) stories = stories.filter(s => s.clusterId === clusterId);
  if (starred === 'true') stories = stories.filter(s => starredIds.has(s.id));
  if (source) stories = stories.filter(s => s.source.name.toLowerCase().includes(source.toLowerCase()));

  // Apply star/read state
  stories = stories.map(s => ({
    ...s,
    isStarred: starredIds.has(s.id),
    isRead: readIds.has(s.id),
  }));

  const offsetN = parseInt(offset);
  const limitN = parseInt(limit);
  const paginated = stories.slice(offsetN, offsetN + limitN);

  res.json({ stories: paginated, total: stories.length });
});

// GET /api/stories/:id
router.get('/:id', (req: Request, res: Response) => {
  const story = getMockStoryById(req.params.id);
  if (!story) return res.status(404).json({ error: 'Story not found' });
  res.json({
    ...story,
    isStarred: starredIds.has(story.id),
    isRead: readIds.has(story.id),
  });
});

// POST /api/stories/:id/star
router.post('/:id/star', (req: Request, res: Response) => {
  const { id } = req.params;
  const story = getMockStoryById(id);
  if (!story) return res.status(404).json({ error: 'Story not found' });

  if (starredIds.has(id)) {
    starredIds.delete(id);
    res.json({ isStarred: false });
  } else {
    starredIds.add(id);
    res.json({ isStarred: true });
  }
});

// POST /api/stories/:id/read
router.post('/:id/read', (req: Request, res: Response) => {
  const { id } = req.params;
  readIds.add(id);
  res.json({ isRead: true });
});

export default router;
