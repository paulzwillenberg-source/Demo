import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { Star, Share2, TrendingUp, ExternalLink, Zap } from 'lucide-react';
import { useStore } from '../../stores/useStore';
import { toggleStar, markRead } from '../../lib/api';
import type { Story } from '../../lib/api';

interface Props {
  story: Story;
}

function getWhatsAppUrl(story: Story): string {
  const summary = story.summary?.narrative?.slice(0, 100) || '';
  const text = encodeURIComponent(`*${story.headline}*\n${summary}\n\n${story.url}`);
  return `https://wa.me/?text=${text}`;
}

export default function FeedCard({ story }: Props) {
  const { setSelectedStory, updateStory } = useStore();
  const publishedAt = new Date(story.publishedAt);
  const ageHours = differenceInHours(new Date(), publishedAt);
  const isNew = ageHours < 4;

  const handleCardClick = async () => {
    setSelectedStory(story);
    if (!story.isRead) {
      updateStory(story.id, { isRead: true });
      await markRead(story.id).catch(() => {});
    }
  };

  const handleStar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const result = await toggleStar(story.id);
      updateStory(story.id, { isStarred: result.isStarred });
    } catch {}
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(getWhatsAppUrl(story), '_blank', 'noopener');
  };

  const hasMarkets = story.kalshiContracts && story.kalshiContracts.length > 0;

  return (
    <article
      className={`card cursor-pointer p-3.5 flex flex-col gap-2 transition-opacity ${
        story.isRead && !story.isStarred ? 'opacity-60' : ''
      }`}
      onClick={handleCardClick}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
        {/* Source */}
        <span className="font-semibold truncate max-w-[100px]" style={{ color: 'var(--color-text)' }}>
          {story.source.name}
        </span>

        <span className="opacity-40">·</span>

        {/* Time */}
        <span>{formatDistanceToNow(publishedAt, { addSuffix: true })}</span>

        {/* NEW badge */}
        {isNew && (
          <>
            <span className="opacity-40">·</span>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--color-new)',
                color: '#fff',
                opacity: Math.max(0.4, 1 - ageHours / 4),
              }}
            >
              NEW
            </span>
          </>
        )}

        {/* Authenticated indicator */}
        {story.isAuthenticated && (
          <span
            className="text-[10px] px-1 py-0.5 rounded"
            style={{ background: 'rgba(5,150,105,0.1)', color: 'var(--color-market)' }}
          >
            Full text
          </span>
        )}

        <div className="flex-1" />

        {/* Topic tag */}
        {story.clusterLabel && (
          <span className="topic-pill shrink-0">{story.clusterLabel}</span>
        )}
      </div>

      {/* Headline */}
      <h3
        className="font-bold leading-snug text-[14px]"
        style={{ color: 'var(--color-text)' }}
      >
        {story.headline}
      </h3>

      {/* Summary preview */}
      {story.summary?.narrative && (
        <p
          className="text-[12px] leading-relaxed line-clamp-3"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {story.summary.narrative}
        </p>
      )}

      {/* Footer row */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        {/* Markets badge */}
        {hasMarkets && (
          <div
            className="flex items-center gap-1 text-[11px] font-semibold"
            style={{ color: 'var(--color-market)' }}
          >
            <TrendingUp size={11} />
            <span>{story.kalshiContracts!.length} market{story.kalshiContracts!.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Action icons */}
        <button
          onClick={handleStar}
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          style={{ color: story.isStarred ? 'var(--color-star)' : 'var(--color-text-muted)' }}
          title={story.isStarred ? 'Unstar' : 'Star'}
        >
          <Star size={13} fill={story.isStarred ? 'currentColor' : 'none'} />
        </button>

        <button
          onClick={handleShare}
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          title="Share to WhatsApp"
        >
          <Share2 size={13} />
        </button>

        <a
          href={story.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          title="Open original"
        >
          <ExternalLink size={13} />
        </a>
      </div>
    </article>
  );
}
