import { useStore } from '../../stores/useStore';
import { useQuery } from '@tanstack/react-query';
import { fetchClusters } from '../../lib/api';

export default function TopicFilterBar() {
  const { selectedClusterId, setSelectedClusterId, setClusters } = useStore();

  const { data } = useQuery({
    queryKey: ['clusters'],
    queryFn: async () => {
      const result = await fetchClusters();
      setClusters(result.clusters);
      return result;
    },
    refetchInterval: 60_000,
  });

  const clusters = data?.clusters || [];

  return (
    <div
      className="flex items-center gap-1.5 px-4 border-b overflow-x-auto shrink-0"
      style={{
        height: 40,
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        scrollbarWidth: 'none',
      }}
    >
      {/* All pill */}
      <button
        onClick={() => setSelectedClusterId(null)}
        className={`topic-pill shrink-0 transition-all ${
          selectedClusterId === null
            ? 'ring-1'
            : 'opacity-70 hover:opacity-100'
        }`}
        style={
          selectedClusterId === null
            ? { ringColor: 'var(--color-brand)', outline: `1px solid var(--color-brand)` }
            : {}
        }
      >
        All Topics
      </button>

      {clusters.map((cluster) => (
        <button
          key={cluster.id}
          onClick={() => setSelectedClusterId(selectedClusterId === cluster.id ? null : cluster.id)}
          className={`topic-pill shrink-0 transition-all ${
            cluster.isHot ? 'hot' : ''
          } ${
            selectedClusterId === cluster.id ? 'ring-1' : 'opacity-70 hover:opacity-100'
          }`}
          style={
            selectedClusterId === cluster.id
              ? {
                  outline: `1px solid ${cluster.isHot ? 'var(--color-alert)' : 'var(--color-brand)'}`,
                }
              : {}
          }
          title={`${cluster.storyCount} stories · ${cluster.velocity.toFixed(1)}/hr`}
        >
          {cluster.isHot && '🔥 '}
          {cluster.label}
          <span className="ml-1 opacity-50 text-[10px]">{cluster.storyCount}</span>
        </button>
      ))}
    </div>
  );
}
