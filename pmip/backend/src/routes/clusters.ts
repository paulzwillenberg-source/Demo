import { Router, Request, Response } from 'express';
import { prisma, isDatabaseConfigured } from '../lib/prisma';
import { getMockClusters } from '../services/mockData';

const router = Router();

// GET /api/clusters
router.get('/', async (_req: Request, res: Response) => {
  if (!isDatabaseConfigured()) {
    return res.json({ clusters: getMockClusters() });
  }

  const clusters = await prisma.cluster.findMany({
    orderBy: { velocity: 'desc' },
    include: { _count: { select: { stories: true } } },
  });

  const shaped = clusters.map(c => ({
    ...c,
    storyCount: c._count.stories,
  }));

  res.json({ clusters: shaped });
});

export default router;
