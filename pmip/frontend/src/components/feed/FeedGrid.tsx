import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchStories, fetchNewsletters } from '../../lib/api';
import { useStore } from '../../stores/useStore';
import FeedCard from './FeedCard';
import type { Story } from '../../lib/api';

function SkeletonCard() {
  return (
    <div className="card p-3.5 space-y-2.5 animate-pulse">
      <div className="flex gap-2">
        <div className="h-3 w-20 rounded" style={{ background: 'var(--color-border)' }} />
        <div className="h-3 w-12 rounded" style={{ background: 'var(--color-border)' }} />
      </div>
      <div className="space-y-1.5">
        <div className="h-4 w-full rounded" style={{ background: 'var(--color-border)' }} />
        <div className="h-4 w-4/5 rounded" style={{ background: 'var(--color-border)' }} />
      </div>
      <div className="space-y-1">
        <div className="h-3 w-full rounded" style={{ background: 'var(--color-border)' }} />
        <div className="h-3 w-5/6 rounded" style={{ background: 'var(--color-border)' }} />
        <div className="h-3 w-3/4 rounded" style={{ background: 'var(--color-border)' }} />
      </div>
    </div>
  );
}

export default function FeedGrid() {
  const {
    stories, setStories,
    selectedClusterId, selectedSourceId,
    viewMode, searchQuery, sources,
  } = useStore();

  const isNewsletterView = viewMode === 'newsletters';

  const { data: storiesData, isLoading: storiesLoading } = useQuery({
    queryKey: ['stories', selectedClusterId, selectedSourceId],
    queryFn: () => fetchStories({
      clusterId: selectedClusterId || undefined,
      source: selectedSourceId || undefined,
      limit: 60,
    }),
    refetchInterval: 30_000,
    enabled: !isNewsletterView,
  });

  const { data: newslettersData, isLoading: newslettersLoading } = useQuery({
    queryKey: ['newsletters'],
    queryFn: () => fetchNewsletters({ limit: 30 }),
    refetchInterval: 60_000,
    enabled: isNewsletterView,
  });

  useEffect(() => {
    const data = isNewsletterView ? newslettersData : storiesData;
    if (data) setStories(data.stories);
  }, [storiesData, newslettersData, isNewsletterView]);

  const isLoading = isNewsletterView ? newslettersLoading : storiesLoading;

  // Apply client-side filters
  let displayed: Story[] = stories;

  if (viewMode === 'starred') {
    displayed = displayed.filter(s => s.isStarred);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    displayed = displayed.filter(s =>
      s.headline.toLowerCase().includes(q) ||
      s.source.name.toLowerCase().includes(q) ||
      s.summary?.narrative?.toLowerCase().includes(q)
    );
  }

  // Resolve selected source name for header
  const selectedSource = selectedSourceId
    ? (sources.find(s => s.id === selectedSourceId) || displayed[0]?.source)
    : null;

  const getTitle = () => {
    if (viewMode === 'starred') return 'Starred Stories';
    if (viewMode === 'newsletters') return 'Newsletters';
    if (selectedSource) return selectedSource.name;
    if (selectedClusterId) return displayed[0]?.clusterLabel || 'Topic';
    return 'Home Feed';
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-w-5xl">
          {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (displayed.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-4xl opacity-20">📰</div>
          <div className="font-semibold" style={{ color: 'var(--color-text)' }}>
            {searchQuery ? 'No results found' : 'No stories yet'}
          </div>
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {searchQuery ? 'Try a different search term' : 'Stories will appear as they are ingested'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 max-w-5xl">
        {/* Feed header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              {getTitle()}
            </h2>
            {selectedSource && (
              <p className="text-[11px] mt-0.5 truncate max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
                {selectedSource.feedUrl}
              </p>
            )}
          </div>
          <span className="text-[11px] shrink-0" style={{ color: 'var(--color-text-muted)' }}>
            {displayed.length} {displayed.length === 1 ? 'story' : 'stories'}
          </span>
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {displayed.map(story => <FeedCard key={story.id} story={story} />)}
        </div>
      </div>
    </div>
  );
}
