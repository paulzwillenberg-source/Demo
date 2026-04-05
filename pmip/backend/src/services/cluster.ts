import { prisma, isDatabaseConfigured } from '../lib/prisma';
import { getMockClusters, getMockStories } from './mockData';

const HOT_VELOCITY_THRESHOLD = 2.5;

export async function runClustering(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.log('[Cluster] No database — skipping clustering');
    return;
  }

  console.log('[Cluster] Running clustering pass...');

  // Count stories per cluster in last 60 minutes
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const clusters = await prisma.cluster.findMany({
    include: {
      _count: { select: { stories: true } },
      stories: {
        where: { publishedAt: { gte: oneHourAgo } },
        select: { id: true },
      },
    },
  });

  for (const cluster of clusters) {
    const velocity = cluster.stories.length; // stories added in last hour
    const isHot = velocity >= HOT_VELOCITY_THRESHOLD;
    await prisma.cluster.update({
      where: { id: cluster.id },
      data: { velocity, isHot },
    });
  }

  console.log(`[Cluster] Updated ${clusters.length} clusters.`);
}
