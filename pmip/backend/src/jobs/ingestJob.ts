import cron from 'node-cron';
import { runIngest } from '../services/ingest';

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    await runIngest();
  } catch (err: any) {
    console.error('[IngestJob] Error:', err.message);
  }
});

console.log('[IngestJob] Scheduled: every 5 minutes');
