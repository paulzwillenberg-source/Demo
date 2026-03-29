import { X, Star, Share2, ExternalLink, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useStore } from '../../stores/useStore';
import { toggleStar } from '../../lib/api';
import { useState } from 'react';
import KalshiContracts from '../kalshi/KalshiContracts';

type ModelTab = 'CLAUDE' | 'GEMINI' | 'ASK';

export default function StoryPanel() {
  const { selectedStory, setSelectedStory, updateStory } = useStore();
  const [activeTab, setActiveTab] = useState<ModelTab>('CLAUDE');
  const [askQuery, setAskQuery] = useState('');
  const [askResponse, setAskResponse] = useState('');
  const [asking, setAsking] = useState(false);
  const [showKalshi, setShowKalshi] = useState(false);

  if (!selectedStory) return null;

  const story = selectedStory;
  const summary = story.summary;
  const hasMarkets = story.kalshiContracts && story.kalshiContracts.length > 0;

  const handleStar = async () => {
    try {
      const result = await toggleStar(story.id);
      updateStory(story.id, { isStarred: result.isStarred });
    } catch {}
  };

  const handleShare = () => {
    const text = encodeURIComponent(`*${story.headline}*\n${summary?.narrative?.slice(0, 100) || ''}\n\n${story.url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
  };

  const handleAsk = async () => {
    if (!askQuery.trim()) return;
    setAsking(true);
    setAskResponse('');
    // In production: call /api/stories/:id/ask with query
    await new Promise((r) => setTimeout(r, 1200));
    setAskResponse(`Based on this story about "${story.headline}", here is my analysis of your question: "${askQuery}".\n\nThis is a placeholder response — connect your Anthropic API key to enable live AI responses.`);
    setAsking(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-30"
        onClick={() => setSelectedStory(null)}
      />

      {/* Panel */}
      <aside
        className="fixed top-0 right-0 h-full z-40 flex flex-col border-l overflow-hidden"
        style={{
          width: 440,
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {/* Source + time */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                {story.source.name}
              </span>
              <ChevronRight size={10} />
              <span>{format(new Date(story.publishedAt), 'MMM d, HH:mm')}</span>
              {story.clusterLabel && (
                <>
                  <ChevronRight size={10} />
                  <span className="topic-pill">{story.clusterLabel}</span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleStar}
              className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ color: story.isStarred ? 'var(--color-star)' : 'var(--color-text-muted)' }}
            >
              <Star size={14} fill={story.isStarred ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={handleShare}
              className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Share2 size={14} />
            </button>
            <a
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <ExternalLink size={14} />
            </a>
            <button
              onClick={() => setSelectedStory(null)}
              className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ml-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-4 space-y-4">
            {/* Headline */}
            <h1
              className="font-bold leading-tight text-[18px]"
              style={{ color: 'var(--color-text)', fontFamily: 'Georgia, serif' }}
            >
              {story.headline}
            </h1>

            {/* Model selector */}
            <div
              className="flex rounded border overflow-hidden"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {(['CLAUDE', 'GEMINI', 'ASK'] as ModelTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-1.5 text-[11px] font-bold tracking-wider transition-colors"
                  style={{
                    background: activeTab === tab ? 'var(--color-brand)' : 'transparent',
                    color: activeTab === tab ? '#fff' : 'var(--color-text-muted)',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* ASK mode */}
            {activeTab === 'ASK' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask anything about this story..."
                    value={askQuery}
                    onChange={(e) => setAskQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                    className="flex-1 px-3 py-2 text-[13px] rounded border outline-none"
                    style={{
                      background: 'var(--color-bg)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  />
                  <button
                    onClick={handleAsk}
                    disabled={asking || !askQuery.trim()}
                    className="px-3 py-1.5 text-[12px] font-semibold rounded transition-colors disabled:opacity-50"
                    style={{ background: 'var(--color-brand)', color: '#fff' }}
                  >
                    {asking ? '...' : 'Ask'}
                  </button>
                </div>
                {askResponse && (
                  <div
                    className="text-[13px] leading-relaxed p-3 rounded border"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  >
                    {askResponse}
                  </div>
                )}
              </div>
            )}

            {/* Summary content */}
            {activeTab !== 'ASK' && (
              <>
                {!summary ? (
                  <div
                    className="text-[13px] text-center py-6"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Summary not yet available
                  </div>
                ) : (
                  <>
                    {/* Paywall limited notice */}
                    {!story.isAuthenticated && (
                      <div
                        className="text-[11px] px-3 py-2 rounded border flex items-center gap-2"
                        style={{
                          background: 'rgba(232,64,64,0.05)',
                          borderColor: 'rgba(232,64,64,0.2)',
                          color: 'var(--color-alert)',
                        }}
                      >
                        <span>⚠</span>
                        <span>Paywall limited — summary based on available text only</span>
                      </div>
                    )}

                    {/* Narrative */}
                    <div className="space-y-1">
                      <div
                        className="text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        Summary
                      </div>
                      <p
                        className="text-[13px] leading-relaxed"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {summary.narrative}
                      </p>
                    </div>

                    {/* Key points */}
                    {summary.keyPoints?.length > 0 && (
                      <div className="space-y-1.5">
                        <div
                          className="text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          Key Points
                        </div>
                        <ul className="space-y-1">
                          {summary.keyPoints.map((point, i) => (
                            <li key={i} className="flex gap-2 text-[12px] leading-relaxed" style={{ color: 'var(--color-text)' }}>
                              <span style={{ color: 'var(--color-brand)' }}>·</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Why it matters */}
                    {summary.whyItMatters && (
                      <div className="space-y-1">
                        <div
                          className="text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          Why It Matters
                        </div>
                        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text)' }}>
                          {summary.whyItMatters}
                        </p>
                      </div>
                    )}

                    {/* What to watch */}
                    {summary.whatToWatch && (
                      <div
                        className="border-l-2 pl-3 py-1"
                        style={{ borderColor: 'var(--color-brand)' }}
                      >
                        <div
                          className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
                          style={{ color: 'var(--color-brand)' }}
                        >
                          What to Watch
                        </div>
                        <p className="text-[12px] italic" style={{ color: 'var(--color-text)' }}>
                          {summary.whatToWatch}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Kalshi contracts */}
            {hasMarkets && (
              <div>
                <button
                  onClick={() => setShowKalshi(!showKalshi)}
                  className="flex items-center gap-2 text-[12px] font-semibold mb-2 transition-colors"
                  style={{ color: 'var(--color-market)' }}
                >
                  <span>Prediction Markets ({story.kalshiContracts!.length})</span>
                  <ChevronRight
                    size={12}
                    className="transition-transform"
                    style={{ transform: showKalshi ? 'rotate(90deg)' : 'none' }}
                  />
                </button>
                {showKalshi && <KalshiContracts contracts={story.kalshiContracts!} />}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-4 py-3 border-t shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 rounded text-[12px] font-semibold transition-colors"
            style={{ background: 'var(--color-brand)', color: '#fff' }}
          >
            Read Full Article
            <ExternalLink size={12} />
          </a>
        </div>
      </aside>
    </>
  );
}
