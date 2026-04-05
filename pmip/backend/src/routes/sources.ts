import { Router, Request, Response } from 'express';
import { prisma, isDatabaseConfigured } from '../lib/prisma';
import { getMockSources } from '../services/mockData';

const router = Router();

// In-memory fallback
let mockSources = getMockSources();

// GET /api/sources
router.get('/', async (_req: Request, res: Response) => {
  if (!isDatabaseConfigured()) {
    return res.json({ sources: mockSources });
  }
  const sources = await prisma.source.findMany({
    where: { isActive: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
  res.json({ sources });
});

// POST /api/sources
router.post('/', async (req: Request, res: Response) => {
  const { name, type, feedUrl, category } = req.body;
  if (!name || !type || !feedUrl) {
    return res.status(400).json({ error: 'name, type, and feedUrl are required' });
  }

  if (!isDatabaseConfigured()) {
    const newSource = { id: `src-${Date.now()}`, name, type, feedUrl, category: category || 'web', isAuthenticated: false };
    mockSources.push(newSource as any);
    return res.status(201).json(newSource);
  }

  const source = await prisma.source.create({
    data: { name, type, feedUrl, category: category || 'web' },
  });
  res.status(201).json(source);
});

// PUT /api/sources/:id
router.put('/:id', async (req: Request, res: Response) => {
  if (!isDatabaseConfigured()) {
    const idx = mockSources.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Source not found' });
    mockSources[idx] = { ...mockSources[idx], ...req.body };
    return res.json(mockSources[idx]);
  }

  const source = await prisma.source.update({
    where: { id: req.params.id },
    data: req.body,
  }).catch(() => null);
  if (!source) return res.status(404).json({ error: 'Source not found' });
  res.json(source);
});

// DELETE /api/sources/:id
router.delete('/:id', async (req: Request, res: Response) => {
  if (!isDatabaseConfigured()) {
    mockSources = mockSources.filter(s => s.id !== req.params.id);
    return res.json({ success: true });
  }

  await prisma.source.update({
    where: { id: req.params.id },
    data: { isActive: false },
  }).catch(() => {});
  res.json({ success: true });
});

export default router;
