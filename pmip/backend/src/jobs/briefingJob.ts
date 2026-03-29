import cron from 'node-cron';
import { generateBriefing } from '../services/briefing';

// Quadri-daily: 06:00, 12:00, 18:00, 00:00 local time
cron.schedule('0 6,12,18,0 * * *', async () => {
  try {
    console.log('[BriefingJob] Generating scheduled briefing...');
    const briefing = await generateBriefing(6);
    console.log(`[BriefingJob] Briefing generated: "${briefing.leadHeadline}"`);
  } catch (err: any) {
    console.error('[BriefingJob] Error:', err.message);
  }
});

console.log('[BriefingJob] Scheduled: 06:00, 12:00, 18:00, 00:00');
