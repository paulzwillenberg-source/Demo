import { Router, Request, Response } from 'express';
import { prisma, isDatabaseConfigured } from '../lib/prisma';
import { getMockStories, getMockStoryById } from '../services/mockData';

const router = Router();

// In-memory starred/read fallback for when DB not configured
const starredIds = new Set<string>();
const readIds = new Set<string>();

// GET /api/stories
router.get('/', async (_req: Request, res: Response) => {
  const { clusterId, starred, source, limit = '50', offset = '0' } = _req.query as Record<string, string>;
  const limitN = parseInt(limit);
  const offsetN = parseInt(offset);

  if (!isDatabaseConfigured()) {
    let stories = getMockStories();
    if (clusterId) stories = stories.filter(s => s.clusterId === clusterId);
    if (starred === 'true') stories = stories.filter(s => starredIds.has(s.id));
    if (source) stories = stories.filter(s => s.source.name.toLowerCase().includes(source.toLowerCase()));
    stories = stories.map(s => ({ ...s, isStarred: starredIds.has(s.id), isRead: readIds.has(s.id) }));
    return res.json({ stories: stories.slice(offsetN, offsetN + limitN), total: stories.length });
  }

  const where: any = {};
  if (clusterId) where.clusterId = clusterId;
  if (starred === 'true') where.isStarred = true;
  if (source) where.source = { name: { contains: source, mode: 'insensitive' } };

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

// GET /api/stories/:id
router.get('/:id', async (req: Request, res: Response) => {
  if (!isDatabaseConfigured()) {
    const story = getMockStoryById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    return res.json({ ...story, isStarred: starredIds.has(story.id), isRead: readIds.has(story.id) });
  }

  const story = await prisma.story.findUnique({
    where: { id: req.params.id },
    include: { source: true, cluster: true },
  });
  if (!story) return res.status(404).json({ error: 'Story not found' });

  res.json({
    ...story,
    clusterLabel: story.cluster?.label ?? null,
    isNew: (Date.now() - story.publishedAt.getTime()) < 4 * 60 * 60 * 1000,
    isAuthenticated: story.source.isAuthenticated,
  });
});

// POST /api/stories/:id/star
router.post('/:id/star', async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!isDatabaseConfigured()) {
    const story = getMockStoryById(id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    const isStarred = starredIds.has(id) ? (starredIds.delete(id), false) : (starredIds.add(id), true);
    return res.json({ isStarred });
  }

  const story = await prisma.story.findUnique({ where: { id } });
  if (!story) return res.status(404).json({ error: 'Story not found' });

  const updated = await prisma.story.update({
    where: { id },
    data: { isStarred: !story.isStarred },
  });
  res.json({ isStarred: updated.isStarred });
});

// POST /api/stories/:id/read
router.post('/:id/read', async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!isDatabaseConfigured()) {
    readIds.add(id);
    return res.json({ isRead: true });
  }

  await prisma.story.update({ where: { id }, data: { isRead: true } }).catch(() => {});
  res.json({ isRead: true });
});

export default router;
