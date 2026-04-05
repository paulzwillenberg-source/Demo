import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { config } from './config';

// Extend Express Request to carry authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; name: string };
    }
  }
}

// Import routes
import authRouter from './routes/auth';
import storiesRouter from './routes/stories';
import sourcesRouter from './routes/sources';
import clustersRouter from './routes/clusters';
import briefingsRouter from './routes/briefings';
import newslettersRouter from './routes/newsletters';
import kalshiRouter from './routes/kalshi';
import gmailRouter from './routes/gmail';
import discoverRouter from './routes/discover';

// Import jobs
import './jobs/ingestJob';
import './jobs/clusterJob';
import './jobs/briefingJob';

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (config.nodeEnv === 'development') {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// Public routes — no auth required
const PUBLIC_PATHS = ['/health', '/api/auth/login', '/api/auth/signup', '/api/gmail/callback'];

// JWT auth middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  if (PUBLIC_PATHS.some(p => req.path === p || req.path.startsWith(p + '/'))) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: missing token' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as { id: string; email: string; name: string };
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: invalid token' });
  }
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.use('/api/auth', authRouter);
app.use('/api/stories', storiesRouter);
app.use('/api/sources', sourcesRouter);
app.use('/api/clusters', clustersRouter);
app.use('/api/briefings', briefingsRouter);
app.use('/api/newsletters', newslettersRouter);
app.use('/api/kalshi', kalshiRouter);
app.use('/api/gmail', gmailRouter);
app.use('/api/discover', discoverRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err.message, err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

app.listen(config.port, () => {
  console.log(`\n🚀 PMIP Backend running on http://localhost:${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Database: ${config.databaseUrl ? 'configured' : 'NOT configured'}`);
  console.log(`   Claude API: ${config.anthropicApiKey ? 'configured' : 'NOT configured (mock mode)'}`);
  console.log(`   Kalshi API: ${config.kalshiApiKey ? 'configured' : 'NOT configured (mock mode)'}\n`);
});

export default app;
