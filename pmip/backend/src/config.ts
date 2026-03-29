import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001'),
  databaseUrl: process.env.DATABASE_URL || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  kalshiApiKey: process.env.KALSHI_API_KEY || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  briefingEmail: process.env.BRIEFING_EMAIL || '',
  briefingFromEmail: process.env.BRIEFING_FROM_EMAIL || 'pmip@yourdomain.com',
  gmailClientId: process.env.GMAIL_CLIENT_ID || '',
  gmailClientSecret: process.env.GMAIL_CLIENT_SECRET || '',
  gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN || '',
  sessionToken: process.env.SESSION_TOKEN || 'dev-token',
  nodeEnv: process.env.NODE_ENV || 'development',
};
