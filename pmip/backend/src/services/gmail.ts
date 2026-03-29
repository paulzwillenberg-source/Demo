import { config } from '../config';

/**
 * Gmail OAuth newsletter ingestion.
 * Reads messages matching configured sender rules via Gmail API.
 * Requires GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN in env.
 */

interface NewsletterMessage {
  id: string;
  sender: string;
  subject: string;
  receivedAt: Date;
  htmlBody: string;
  textBody: string;
}

const NEWSLETTER_SENDERS = [
  'newsletters@paulkrugman.substack.com',
  'newsletters@substack.com',
  'ezraklein@nytimes.com',
  'kara@pivot.fm',
  'scott@pivot.fm',
  'hello@morningbrew.com',
  'hello@tldr.tech',
  'hello@thehustle.co',
  '1440digest@join1440.com',
  'derek@theatlantic.com',
];

async function getAccessToken(): Promise<string> {
  if (!config.gmailClientId || !config.gmailClientSecret || !config.gmailRefreshToken) {
    throw new Error('Gmail OAuth credentials not configured');
  }

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

  if (!resp.ok) throw new Error('Failed to refresh Gmail access token');
  const data = await resp.json() as { access_token: string };
  return data.access_token;
}

export async function fetchNewsletters(maxResults = 20): Promise<NewsletterMessage[]> {
  if (!config.gmailRefreshToken) {
    console.warn('[Gmail] OAuth not configured; newsletter ingestion disabled');
    return [];
  }

  const token = await getAccessToken();
  const senderQuery = NEWSLETTER_SENDERS.map(s => `from:${s}`).join(' OR ');
  const query = encodeURIComponent(`(${senderQuery}) is:unread`);

  const listResp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!listResp.ok) throw new Error('Gmail list messages failed');
  const listData = await listResp.json() as { messages?: { id: string }[] };
  const messageIds = (listData.messages || []).map(m => m.id);

  const messages: NewsletterMessage[] = [];

  for (const msgId of messageIds) {
    try {
      const msgResp = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!msgResp.ok) continue;
      const msg = await msgResp.json() as any;

      const headers = msg.payload?.headers || [];
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const sender = headers.find((h: any) => h.name === 'From')?.value || '';
      const date = headers.find((h: any) => h.name === 'Date')?.value || '';

      let htmlBody = '';
      let textBody = '';

      function extractBody(part: any) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/plain' && part.body?.data) {
          textBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.parts) part.parts.forEach(extractBody);
      }

      extractBody(msg.payload);

      messages.push({
        id: msgId,
        sender,
        subject,
        receivedAt: date ? new Date(date) : new Date(),
        htmlBody,
        textBody,
      });
    } catch (err: any) {
      console.warn(`[Gmail] Failed to fetch message ${msgId}:`, err.message);
    }
  }

  return messages;
}
