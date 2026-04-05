import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { Star, Share2, TrendingUp, ExternalLink } from 'lucide-react';
import { useStore } from '../../stores/useStore';
import { toggleStar, markRead } from '../../lib/api';
import type { Story } from '../../lib/api';

interface Props {
  story: Story;
}

/** Strip HTML tags and collapse whitespace */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Get a 1-2 sentence preview for the card */
function getPreview(story: Story): string | null {
  if (story.summary?.narrative) {
    // Trim to first 2 sentences or 160 chars
    const text = story.summary.narrative;
    const sentenceEnd = text.search(/(?<=[.!?])\s+[A-Z]/);
    const twoSentences = sentenceEnd > 40 ? text.slice(0, sentenceEnd + 1) : text;
    return twoSentences.length > 160 ? twoSentences.slice(0, 157) + '…' : twoSentences;
  }
  if (story.fullText) {
    const plain = stripHtml(story.fullText);
    return plain.length > 160 ? plain.slice(0, 157) + '…' : plain;
  }
  return null;
}

function getWhatsAppUrl(story: Story): string {
  const preview = getPreview(story) || '';
  const text = encodeURIComponent(`*${story.headline}*\n${preview}\n\n${story.url}`);
  return `https://wa.me/?text=${text}`;
}

export default function FeedCard({ story }: Props) {
  const { setSelectedStory, updateStory } = useStore();
  const publishedAt = new Date(story.publishedAt);
  const ageHours = differenceInHours(new Date(), publishedAt);
  const isNew = ageHours < 4;
  const preview = getPreview(story);
  const hasMarkets = story.kalshiContracts && story.kalshiContracts.length > 0;

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

  return (
    <article
      className={`card cursor-pointer p-4 flex flex-col gap-2 transition-opacity ${
        story.isRead && !story.isStarred ? 'opacity-55' : ''
      }`}
      onClick={handleCardClick}
    >
      {/* Source + time row */}
      <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
        <span className="font-semibold truncate max-w-[120px]" style={{ color: 'var(--color-text)' }}>
          {story.source.name}
        </span>
        <span className="opacity-30">·</span>
        <span className="shrink-0">{formatDistanceToNow(publishedAt, { addSuffix: true })}</span>
        {isNew && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
            style={{ background: 'var(--color-new)', color: '#fff' }}
          >
            NEW
          </span>
        )}
        <div className="flex-1" />
        {story.clusterLabel && (
          <span className="topic-pill shrink-0">{story.clusterLabel}</span>
        )}
      </div>

      {/* Bold headline */}
      <h3
        className="font-bold leading-snug text-[14px]"
        style={{ color: 'var(--color-text)' }}
      >
        {story.headline}
      </h3>

      {/* 1-2 sentence summary in plain text */}
      {preview && (
        <p
          className="text-[12px] leading-relaxed line-clamp-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {preview}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-1 mt-auto pt-0.5">
        {hasMarkets && (
          <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--color-market)' }}>
            <TrendingUp size={11} />
            <span>{story.kalshiContracts!.length} market{story.kalshiContracts!.length !== 1 ? 's' : ''}</span>
          </div>
        )}
        <div className="flex-1" />
        <button onClick={handleStar}
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          style={{ color: story.isStarred ? 'var(--color-star)' : 'var(--color-text-muted)' }}
          title={story.isStarred ? 'Unstar' : 'Star'}>
          <Star size={13} fill={story.isStarred ? 'currentColor' : 'none'} />
        </button>
        <button onClick={handleShare}
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          title="Share to WhatsApp">
          <Share2 size={13} />
        </button>
        <a href={story.url} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          title="Open original">
          <ExternalLink size={13} />
        </a>
      </div>
    </article>
  );
}
