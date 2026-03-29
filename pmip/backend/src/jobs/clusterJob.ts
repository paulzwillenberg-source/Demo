import cron from 'node-cron';
import { runClustering } from '../services/cluster';

// Run every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  try {
    await runClustering();
  } catch (err: any) {
    console.error('[ClusterJob] Error:', err.message);
  }
});

console.log('[ClusterJob] Scheduled: every 15 minutes');
