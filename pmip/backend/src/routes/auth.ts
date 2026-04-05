import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma, isDatabaseConfigured } from '../lib/prisma';
import { config } from '../config';

const router = Router();

function signToken(user: { id: string; email: string; name: string }) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, config.jwtSecret, {
    expiresIn: '30d',
  });
}

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({ error: 'email, name, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  if (!isDatabaseConfigured()) {
    return res.status(503).json({ error: 'Database not configured — cannot create accounts' });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), name, password: hashed },
  });

  const token = signToken(user);
  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  if (!isDatabaseConfigured()) {
    return res.status(503).json({ error: 'Database not configured — cannot authenticate' });
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

// GET /api/auth/me
router.get('/me', (req: Request, res: Response) => {
  res.json({ user: (req as any).user });
});

export default router;
