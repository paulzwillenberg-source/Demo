import { X, ExternalLink, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Story } from '../../lib/api';

interface Props {
  story: Story;
  onClose: () => void;
}

export default function NewsletterPanel({ story, onClose }: Props) {
  // In production, fetch full HTML from /api/newsletters/:id
  // For now, render available summary content
  const hasHtml = false; // would be true when htmlBody available from API

  return (
    <>
      <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-30" onClick={onClose} />
      <aside
        className="fixed top-0 right-0 h-full z-40 flex flex-col border-l"
        style={{ width: 560, background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[14px] truncate" style={{ color: 'var(--color-text)' }}>
              {story.source.name}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {format(new Date(story.publishedAt), 'EEEE, MMMM d · HH:mm')}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1.5 rounded text-[11px] font-semibold border transition-colors"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              <ExternalLink size={11} />
              <span>Read in App</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Newsletter subject */}
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h1 className="font-bold text-[16px] leading-snug" style={{ color: 'var(--color-text)' }}>
            {story.headline}
          </h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {hasHtml ? (
            /* Render original newsletter HTML in scoped iframe */
            <iframe
              title="Newsletter content"
              className="w-full h-full border-none"
              sandbox="allow-same-origin"
              srcDoc={`<html><head><style>body{font-family:sans-serif;padding:20px;max-width:100%;}</style></head><body></body></html>`}
            />
          ) : (
            /* Show AI summary */
            <div className="px-4 py-4 space-y-4">
              {story.summary ? (
                <>
                  <div
                    className="text-[11px] px-3 py-2 rounded border"
                    style={{
                      background: 'rgba(43,58,140,0.05)',
                      borderColor: 'rgba(43,58,140,0.15)',
                      color: 'var(--color-brand)',
                    }}
                  >
                    AI-generated summary — configure Gmail OAuth to render the original HTML
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                      Summary
                    </div>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text)' }}>
                      {story.summary.narrative}
                    </p>
                  </div>
                  {story.summary.keyPoints?.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                        Key Points
                      </div>
                      <ul className="space-y-1">
                        {story.summary.keyPoints.map((pt, i) => (
                          <li key={i} className="flex gap-2 text-[12px]" style={{ color: 'var(--color-text)' }}>
                            <span style={{ color: 'var(--color-brand)' }}>·</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                  <div className="text-3xl mb-3">📧</div>
                  <div className="text-[13px]">Newsletter content loading...</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions footer */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-t shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold"
            style={{ background: 'var(--color-brand)', color: '#fff' }}
          >
            <ExternalLink size={12} />
            Read in Email Client
          </a>
          <button
            onClick={() => {
              const text = encodeURIComponent(`${story.headline}\n${story.url}`);
              window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold border transition-colors"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            <Share2 size={12} />
            Share
          </button>
        </div>
      </aside>
    </>
  );
}
