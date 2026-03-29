import { Router, Request, Response } from 'express';
import { getMockClusters } from '../services/mockData';

const router = Router();

// GET /api/clusters
router.get('/', (_req: Request, res: Response) => {
  const clusters = getMockClusters();
  res.json({ clusters });
});

export default router;
