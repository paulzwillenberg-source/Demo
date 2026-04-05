import { Router, Request, Response } from 'express';
import { config } from '../config';
import { prisma, isDatabaseConfigured } from '../lib/prisma';

const router = Router();

const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
// After OAuth callback, redirect user back to the frontend
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const REDIRECT_URI = `${process.env.APP_URL || 'http://localhost:3001'}/api/gmail/callback`;

// ── GET /api/gmail/status ──────────────────────────────────────────────────
// Returns whether the current user has connected their Gmail account
router.get('/status', async (req: Request, res: Response) => {
  if (!isDatabaseConfigured()) {
    return res.json({ connected: false, configured: false });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { gmailRefreshToken: true, gmailConnectedAt: true },
  });

  res.json({
    connected: !!user?.gmailRefreshToken,
    connectedAt: user?.gmailConnectedAt ?? null,
    configured: !!config.gmailClientId,
  });
});

// ── GET /api/gmail/auth ────────────────────────────────────────────────────
// Returns a Google OAuth URL for the current user
router.get('/auth', (req: Request, res: Response) => {
  if (!config.gmailClientId) {
    return res.status(400).json({
      error: 'Gmail OAuth not configured on this server. Add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET to the backend .env',
    });
  }

  // Encode the user's ID in the OAuth state so we can match them on callback
  const state = Buffer.from(JSON.stringify({ userId: req.user!.id })).toString('base64url');

  const params = new URLSearchParams({
    client_id: config.gmailClientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  res.json({ authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

// ── GET /api/gmail/callback ────────────────────────────────────────────────
// Google redirects here after consent. No JWT required — the user ID is in state.
// This route is called without a Bearer token (it's a browser redirect from Google).
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    return res.redirect(`${FRONTEND_URL}?gmail=error&reason=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.redirect(`${FRONTEND_URL}?gmail=error&reason=missing_params`);
  }

  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    userId = decoded.userId;
  } catch {
    return res.redirect(`${FRONTEND_URL}?gmail=error&reason=invalid_state`);
  }

  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.gmailClientId,
        client_secret: config.gmailClientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await resp.json() as any;
    if (!tokens.refresh_token) {
      return res.redirect(`${FRONTEND_URL}?gmail=error&reason=no_refresh_token`);
    }

    // Save refresh token to this user's record
    if (isDatabaseConfigured()) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          gmailRefreshToken: tokens.refresh_token,
          gmailConnectedAt: new Date(),
        },
      });
    }

    res.redirect(`${FRONTEND_URL}?gmail=connected`);
  } catch (err: any) {
    console.error('[Gmail OAuth callback]', err.message);
    res.redirect(`${FRONTEND_URL}?gmail=error&reason=token_exchange_failed`);
  }
});

// ── DELETE /api/gmail/disconnect ───────────────────────────────────────────
router.delete('/disconnect', async (req: Request, res: Response) => {
  if (isDatabaseConfigured()) {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { gmailRefreshToken: null, gmailConnectedAt: null },
    });
  }
  res.json({ success: true });
});

// ── GET /api/gmail/scan ────────────────────────────────────────────────────
router.get('/scan', async (req: Request, res: Response) => {
  // Check for user's personal refresh token first
  let refreshToken = config.gmailRefreshToken; // global fallback (legacy)

  if (isDatabaseConfigured()) {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { gmailRefreshToken: true },
    });
    if (user?.gmailRefreshToken) refreshToken = user.gmailRefreshToken;
  }

  if (!refreshToken) {
    return res.json({ newsletters: getMockDiscoveredNewsletters(), demo: true });
  }

  try {
    const token = await getAccessToken(refreshToken);
    const newsletters = await scanInboxForNewsletters(token);
    res.json({ newsletters, demo: false });
  } catch (err: any) {
    console.error('[Gmail Scan]', err.message);
    res.json({ newsletters: getMockDiscoveredNewsletters(), demo: true });
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function getAccessToken(refreshToken: string): Promise<string> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.gmailClientId,
      client_secret: config.gmailClientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await resp.json() as any;
  if (!data.access_token) throw new Error('Failed to get access token');
  return data.access_token;
}

interface DiscoveredNewsletter {
  sender: string;
  name: string;
  email: string;
  messageCount: number;
  lastReceived: string;
  confidence: 'high' | 'medium' | 'low';
}

async function scanInboxForNewsletters(token: string): Promise<DiscoveredNewsletter[]> {
  const query = encodeURIComponent('has:unsubscribe newer_than:90d');
  const listResp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=500`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const listData = await listResp.json() as any;
  const messages = listData.messages || [];

  const senderMap = new Map<string, { name: string; email: string; count: number; lastDate: string; hasListId: boolean }>();
  const sample = messages.slice(0, 100);

  await Promise.all(sample.map(async (msg: any) => {
    try {
      const msgResp = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=List-Id&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const msgData = await msgResp.json() as any;
      const headers = msgData.payload?.headers || [];

      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const listId = headers.find((h: any) => h.name === 'List-Id')?.value || '';
      const date = headers.find((h: any) => h.name === 'Date')?.value || '';

      const emailMatch = from.match(/<(.+?)>/) || from.match(/(\S+@\S+)/);
      const email = emailMatch?.[1] || from;
      const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
      const name = nameMatch?.[1]?.trim() || email.split('@')[0];

      if (!email || !email.includes('@')) return;

      const existing = senderMap.get(email) || { name, email, count: 0, lastDate: date, hasListId: false };
      senderMap.set(email, {
        ...existing,
        count: existing.count + 1,
        lastDate: date || existing.lastDate,
        hasListId: existing.hasListId || !!listId,
      });
    } catch {}
  }));

  const results: DiscoveredNewsletter[] = [];
  for (const [email, data] of senderMap.entries()) {
    const confidence: 'high' | 'medium' | 'low' =
      data.hasListId ? 'high' : data.count >= 3 ? 'medium' : 'low';
    results.push({
      sender: `${data.name} <${email}>`,
      name: data.name,
      email,
      messageCount: data.count,
      lastReceived: data.lastDate,
      confidence,
    });
  }

  return results.filter(r => r.messageCount >= 2).sort((a, b) => b.messageCount - a.messageCount);
}

function getMockDiscoveredNewsletters(): DiscoveredNewsletter[] {
  return [
    { sender: 'Morning Brew <hello@morningbrew.com>', name: 'Morning Brew', email: 'hello@morningbrew.com', messageCount: 90, lastReceived: 'Sat, 5 Apr 2026', confidence: 'high' },
    { sender: 'TLDR Newsletter <hello@tldr.tech>', name: 'TLDR Newsletter', email: 'hello@tldr.tech', messageCount: 85, lastReceived: 'Sat, 5 Apr 2026', confidence: 'high' },
    { sender: 'Politico Playbook <playbook@politico.com>', name: 'Politico Playbook', email: 'playbook@politico.com', messageCount: 45, lastReceived: 'Sat, 5 Apr 2026', confidence: 'high' },
    { sender: 'Axios AM <mike@axios.com>', name: 'Axios AM', email: 'mike@axios.com', messageCount: 30, lastReceived: 'Sat, 5 Apr 2026', confidence: 'medium' },
    { sender: 'Semafor <newsletters@semafor.com>', name: 'Semafor', email: 'newsletters@semafor.com', messageCount: 22, lastReceived: 'Sat, 5 Apr 2026', confidence: 'high' },
    { sender: 'Ezra Klein <ezraklein@nytimes.com>', name: 'Ezra Klein', email: 'ezraklein@nytimes.com', messageCount: 18, lastReceived: 'Fri, 4 Apr 2026', confidence: 'high' },
    { sender: 'Pivot <kara@pivot.fm>', name: 'Pivot', email: 'kara@pivot.fm', messageCount: 12, lastReceived: 'Thu, 3 Apr 2026', confidence: 'high' },
    { sender: 'The Information <tips@theinformation.com>', name: 'The Information', email: 'tips@theinformation.com', messageCount: 8, lastReceived: 'Thu, 3 Apr 2026', confidence: 'medium' },
    { sender: 'Puck <hello@puck.news>', name: 'Puck', email: 'hello@puck.news', messageCount: 15, lastReceived: 'Fri, 4 Apr 2026', confidence: 'medium' },
    { sender: '1440 Daily <1440digest@join1440.com>', name: '1440 Daily', email: '1440digest@join1440.com', messageCount: 90, lastReceived: 'Sat, 5 Apr 2026', confidence: 'high' },
    { sender: 'The Hustle <hello@thehustle.co>', name: 'The Hustle', email: 'hello@thehustle.co', messageCount: 78, lastReceived: 'Sat, 5 Apr 2026', confidence: 'high' },
    { sender: 'Paul Krugman <newsletters@paulkrugman.substack.com>', name: 'Paul Krugman', email: 'newsletters@paulkrugman.substack.com', messageCount: 24, lastReceived: 'Sat, 5 Apr 2026', confidence: 'high' },
  ];
}

export default router;
