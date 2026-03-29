import { getMockClusters, getMockStories, MockCluster } from './mockData';

// Velocity threshold for "hot" clusters (stories/hour)
const HOT_VELOCITY_THRESHOLD = 2.5;

export interface ClusterResult {
  clusters: MockCluster[];
  updatedAt: string;
}

/**
 * In production: embed stories with OpenAI, run DBSCAN, label with Claude.
 * For now, computes dynamic velocity from mock data and returns enriched clusters.
 */
export async function runClustering(): Promise<ClusterResult> {
  const stories = getMockStories();
  const clusters = getMockClusters();
  const now = new Date();

  // Count stories per cluster in last 60 minutes
  const recentCounts = new Map<string, number>();
  for (const story of stories) {
    if (!story.clusterId) continue;
    const age = (now.getTime() - new Date(story.publishedAt).getTime()) / 1000 / 60;
    if (age <= 60) {
      recentCounts.set(story.clusterId, (recentCounts.get(story.clusterId) || 0) + 1);
    }
  }

  const enriched: MockCluster[] = clusters.map(c => {
    const recentCount = recentCounts.get(c.id) || 0;
    const velocity = recentCount; // stories/hour
    return {
      ...c,
      velocity,
      isHot: velocity >= HOT_VELOCITY_THRESHOLD,
    };
  });

  // Sort by velocity desc
  enriched.sort((a, b) => b.velocity - a.velocity);

  console.log(`[Cluster] Updated ${enriched.length} clusters.`);
  return { clusters: enriched, updatedAt: now.toISOString() };
}
