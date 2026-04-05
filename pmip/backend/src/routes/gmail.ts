import { Router, Request, Response } from 'express';
import { config } from '../config';

const router = Router();

const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
const REDIRECT_URI = `${process.env.APP_URL || 'http://localhost:3001'}/api/gmail/callback`;

// Newsletter detection heuristics
const NEWSLETTER_HEADERS = ['list-unsubscribe', 'list-id', 'x-mailchimp', 'x-campaign', 'x-mailer'];
const NEWSLETTER_KEYWORDS = ['unsubscribe', 'newsletter', 'digest', 'weekly', 'daily', 'update', 'edition'];

// GET /api/gmail/auth — returns OAuth URL for frontend to redirect to
router.get('/auth', (_req: Request, res: Response) => {
  if (!config.gmailClientId) {
    return res.status(400).json({ error: 'Gmail OAuth not configured. Add GMAIL_CLIENT_ID to your .env' });
  }

  const params = new URLSearchParams({
    client_id: config.gmailClientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  });

  res.json({ authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

// GET /api/gmail/callback — OAuth callback, exchanges code for token
router.get('/callback', async (req: Request, res: Response) => {
  const { code } = req.query as { code: string };
  if (!code) return res.status(400).json({ error: 'No code provided' });

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
      return res.status(400).json({ error: 'No refresh token returned. Try revoking access at myaccount.google.com/permissions and reconnecting.' });
    }

    // Return token to frontend — user adds to .env
    res.json({
      refresh_token: tokens.refresh_token,
      message: 'Copy this refresh token into your .env as GMAIL_REFRESH_TOKEN',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gmail/scan — scan inbox and return discovered newsletter senders
router.get('/scan', async (_req: Request, res: Response) => {
  if (!config.gmailRefreshToken) {
    // Return mock discovered newsletters for demo
    return res.json({ newsletters: getMockDiscoveredNewsletters(), demo: true });
  }

  try {
    const token = await getAccessToken();
    const newsletters = await scanInboxForNewsletters(token);
    res.json({ newsletters, demo: false });
  } catch (err: any) {
    console.error('[Gmail Scan]', err.message);
    res.json({ newsletters: getMockDiscoveredNewsletters(), demo: true });
  }
});

async function getAccessToken(): Promise<string> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.gmailClientId,
      client_secret: config.gmailClientSecret,
      refresh_token: config.gmailRefreshToken,
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
  // Search last 90 days for messages with unsubscribe links
  const query = encodeURIComponent('has:unsubscribe newer_than:90d');
  const listResp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=500`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const listData = await listResp.json() as any;
  const messages = listData.messages || [];

  // Sample up to 100 messages to identify senders
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

  // Filter and rank
  const results: DiscoveredNewsletter[] = [];
  for (const [email, data] of senderMap.entries()) {
    const confidence: 'high' | 'medium' | 'low' =
      data.hasListId ? 'high' :
      data.count >= 3 ? 'medium' : 'low';

    results.push({
      sender: `${data.name} <${email}>`,
      name: data.name,
      email,
      messageCount: data.count,
      lastReceived: data.lastDate,
      confidence,
    });
  }

  return results
    .filter(r => r.messageCount >= 2)
    .sort((a, b) => b.messageCount - a.messageCount);
}

function getMockDiscoveredNewsletters(): DiscoveredNewsletter[] {
  return [
    { sender: 'Paul Krugman <newsletters@paulkrugman.substack.com>', name: 'Paul Krugman', email: 'newsletters@paulkrugman.substack.com', messageCount: 24, lastReceived: 'Sat, 5 Apr 2026', confidence: 'high' },
    { sender: 'Morning Brew <hello@morningbrew.com>', name: 'Morning Brew', email: 'hello@morningbrew.com', messageCount: 90, lastReceived: 'Sat, 5 Apr 2026', confidence: 'high' },
    { sender: 'TLDR Newsletter <hello@tldr.tech>', name: 'TLDR Newsletter', email: 'hello@tldr.tech', messageCount: 85, lastReceived: 'Sat, 5 Apr 2026', confidence: 'high' },
    { sender: 'Ezra Klein <ezraklein@nytimes.com>', name: 'Ezra Klein', email: 'ezraklein@nytimes.com', messageCount: 18, lastReceived: 'Fri, 4 Apr 2026', confidence: 'high' },
    { sender: 'The Hustle <hello@thehustle.co>', name: 'The Hustle', email: 'hello@thehustle.co', messageCount: 78, lastReceived: 'Sat, 5 Apr 2026', confidence: 'high' },
    { sender: 'Pivot <kara@pivot.fm>', name: 'Pivot', email: 'kara@pivot.fm', messageCount: 12, lastReceived: 'Thu, 3 Apr 2026', confidence: 'high' },
    { sender: '1440 Daily <1440digest@join1440.com>', name: '1440 Daily', email: '1440digest@join1440.com', messageCount: 90, lastReceived: 'Sat, 5 Apr 2026', confidence: 'high' },
    { sender: 'Semafor <newsletters@semafor.com>', name: 'Semafor', email: 'newsletters@semafor.com', messageCount: 22, lastReceived: 'Sat, 5 Apr 2026', confidence: 'high' },
    { sender: 'Axios AM <mike@axios.com>', name: 'Axios AM', email: 'mike@axios.com', messageCount: 30, lastReceived: 'Sat, 5 Apr 2026', confidence: 'medium' },
    { sender: 'Puck <hello@puck.news>', name: 'Puck', email: 'hello@puck.news', messageCount: 15, lastReceived: 'Fri, 4 Apr 2026', confidence: 'medium' },
    { sender: 'The Information <tips@theinformation.com>', name: 'The Information', email: 'tips@theinformation.com', messageCount: 8, lastReceived: 'Thu, 3 Apr 2026', confidence: 'medium' },
    { sender: 'Politico Playbook <playbook@politico.com>', name: 'Politico Playbook', email: 'playbook@politico.com', messageCount: 45, lastReceived: 'Sat, 5 Apr 2026', confidence: 'high' },
  ];
}

export default router;
