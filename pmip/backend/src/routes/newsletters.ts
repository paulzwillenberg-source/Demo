import { Router, Request, Response } from 'express';
import { prisma, isDatabaseConfigured } from '../lib/prisma';
import { getMockStories } from '../services/mockData';

const router = Router();

// GET /api/newsletters
router.get('/', async (_req: Request, res: Response) => {
  const { limit = '30', offset = '0' } = _req.query as Record<string, string>;
  const limitN = parseInt(limit);
  const offsetN = parseInt(offset);

  if (!isDatabaseConfigured()) {
    const all = getMockStories().filter(s => s.source.type === 'NEWSLETTER');
    return res.json({ stories: all.slice(offsetN, offsetN + limitN), total: all.length });
  }

  const where = { source: { type: 'NEWSLETTER' as const } };
  const [stories, total] = await Promise.all([
    prisma.story.findMany({
      where,
      include: { source: true, cluster: true },
      orderBy: { publishedAt: 'desc' },
      take: limitN,
      skip: offsetN,
    }),
    prisma.story.count({ where }),
  ]);

  const shaped = stories.map(s => ({
    ...s,
    clusterLabel: s.cluster?.label ?? null,
    isNew: (Date.now() - s.publishedAt.getTime()) < 4 * 60 * 60 * 1000,
    isAuthenticated: s.source.isAuthenticated,
  }));

  res.json({ stories: shaped, total });
});

// GET /api/newsletters/:id
router.get('/:id', async (req: Request, res: Response) => {
  if (!isDatabaseConfigured()) {
    const story = getMockStories().find(s => s.id === req.params.id && s.source.type === 'NEWSLETTER');
    if (!story) return res.status(404).json({ error: 'Newsletter not found' });
    return res.json(story);
  }

  const story = await prisma.story.findFirst({
    where: { id: req.params.id, source: { type: 'NEWSLETTER' } },
    include: { source: true, cluster: true },
  });
  if (!story) return res.status(404).json({ error: 'Newsletter not found' });
  res.json({ ...story, clusterLabel: story.cluster?.label ?? null });
});

export default router;
