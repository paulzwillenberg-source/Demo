import { Router, Request, Response } from 'express';
import { getMockSources } from '../services/mockData';

const router = Router();

// In-memory source store (would use Prisma in production)
let sources = getMockSources();

// GET /api/sources
router.get('/', (_req: Request, res: Response) => {
  res.json({ sources });
});

// POST /api/sources
router.post('/', (req: Request, res: Response) => {
  const { name, type, feedUrl, category } = req.body;
  if (!name || !type || !feedUrl) {
    return res.status(400).json({ error: 'name, type, and feedUrl are required' });
  }
  const newSource = {
    id: `src-${Date.now()}`,
    name,
    type,
    feedUrl,
    category: category || 'web',
    isAuthenticated: false,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  sources.push(newSource);
  res.status(201).json(newSource);
});

// PUT /api/sources/:id
router.put('/:id', (req: Request, res: Response) => {
  const idx = sources.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Source not found' });
  sources[idx] = { ...sources[idx], ...req.body, updatedAt: new Date().toISOString() };
  res.json(sources[idx]);
});

// DELETE /api/sources/:id
router.delete('/:id', (req: Request, res: Response) => {
  const idx = sources.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Source not found' });
  sources.splice(idx, 1);
  res.json({ success: true });
});

export default router;
