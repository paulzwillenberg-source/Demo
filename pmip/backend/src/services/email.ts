import { Resend } from 'resend';
import { config } from '../config';
import { format } from 'date-fns';
import type { BriefingResult } from './briefing';

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    if (!config.resendApiKey) throw new Error('RESEND_API_KEY not configured');
    resend = new Resend(config.resendApiKey);
  }
  return resend;
}

function buildBriefingHtml(briefing: BriefingResult): string {
  const ts = format(new Date(briefing.generatedAt), "EEEE, MMMM d · HH:mm");
  const { content } = briefing;
  const lead = content?.leadNarrative;

  const sectionsHtml = (content?.sections || [])
    .map((section: any) => {
      const storiesHtml = (section.stories || [])
        .map((s: any) => `
          <li style="margin-bottom:10px;">
            <a href="${s.url}" style="color:#2B3A8C;font-weight:600;text-decoration:none;">${s.headline}</a>
            <span style="color:#666;font-size:13px;"> — ${s.summary}</span>
            <span style="color:#999;font-size:12px;"> [${s.sourceCount} source${s.sourceCount !== 1 ? 's' : ''}]</span>
          </li>`)
        .join('');
      return `
        <div style="margin-bottom:28px;">
          <h3 style="font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#E84040;margin:0 0 10px 0;border-bottom:1px solid #eee;padding-bottom:6px;">${section.label}</h3>
          <ul style="margin:0;padding-left:18px;">${storiesHtml}</ul>
        </div>`;
    })
    .join('');

  const citationsHtml = (lead?.citations || [])
    .map((c: any) => `<a href="${c.url}" style="color:#2B3A8C;margin-right:12px;font-size:12px;">${c.label}</a>`)
    .join('');

  const paragraphsHtml = (lead?.paragraphs || [])
    .map((p: string) => `<p style="line-height:1.7;margin:0 0 14px 0;color:#1A1A2E;">${p}</p>`)
    .join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F9F8F6;font-family:Georgia,serif;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e0ddd8;">
    <!-- Header -->
    <div style="background:#1A1A2E;padding:24px 32px;">
      <div style="font-family:-apple-system,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#aaa;margin-bottom:4px;">PVA Intelligence</div>
      <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.02em;">PMIP Briefing</div>
      <div style="font-size:13px;color:#aaa;margin-top:4px;">${ts}</div>
    </div>

    <!-- Corpus meta -->
    <div style="background:#2B3A8C;padding:10px 32px;">
      <span style="font-family:-apple-system,sans-serif;font-size:12px;color:rgba(255,255,255,0.85);">
        ${briefing.topicCount} trending topics &nbsp;·&nbsp; ${briefing.storyCount} stories analysed
      </span>
    </div>

    <!-- Lead story -->
    <div style="padding:32px 32px 24px;">
      <div style="font-family:-apple-system,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#E84040;margin-bottom:10px;">Lead Narrative</div>
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 20px 0;color:#1A1A2E;">${briefing.leadHeadline}</h1>
      ${paragraphsHtml}
      <div style="margin-top:12px;">${citationsHtml}</div>
    </div>

    <!-- Divider -->
    <div style="height:1px;background:#e0ddd8;margin:0 32px;"></div>

    <!-- Topic sections -->
    <div style="padding:24px 32px 32px;">
      <div style="font-family:-apple-system,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#666;margin-bottom:20px;">Secondary Digest</div>
      ${sectionsHtml}
    </div>

    <!-- Footer -->
    <div style="background:#f4f2ef;padding:16px 32px;border-top:1px solid #e0ddd8;">
      <p style="font-family:-apple-system,sans-serif;font-size:11px;color:#999;margin:0;">
        Personal Media Intelligence Platform &nbsp;·&nbsp; Generated ${ts} &nbsp;·&nbsp; ${briefing.windowHours}h window
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendBriefingEmail(briefing: BriefingResult): Promise<void> {
  const client = getResend();
  const ts = format(new Date(briefing.generatedAt), "EEEE, MMMM d · HH:mm");
  const subject = `PVA Intelligence: Briefing as of ${ts}`;

  await client.emails.send({
    from: config.briefingFromEmail || 'pmip@yourdomain.com',
    to: config.briefingEmail,
    subject,
    html: buildBriefingHtml(briefing),
  });

  console.log(`[Email] Briefing sent to ${config.briefingEmail}`);
}
