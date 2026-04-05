import { X, RefreshCw, ChevronDown, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useStore } from '../../stores/useStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchLatestBriefing, generateBriefing } from '../../lib/api';
import { useState, useEffect } from 'react';
import type { Briefing } from '../../lib/api';

const WINDOW_OPTIONS = [
  { value: 6, label: 'Past 6h' },
  { value: 8, label: 'Past 8h' },
  { value: 24, label: 'Past 24h' },
];

export default function BriefingModal() {
  const { briefingOpen, setBriefingOpen, briefing, setBriefing } = useStore();
  const [windowHours, setWindowHours] = useState(6);
  const [windowMenuOpen, setWindowMenuOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['briefing-latest'],
    queryFn: async () => {
      const b = await fetchLatestBriefing();
      setBriefing(b);
      return b;
    },
    enabled: briefingOpen,
  });

  const regenerateMutation = useMutation({
    mutationFn: () => generateBriefing(windowHours),
    onSuccess: (b) => {
      setBriefing(b);
      queryClient.setQueryData(['briefing-latest'], b);
    },
  });

  const activeBriefing: Briefing | null = briefing || data || null;

  if (!briefingOpen) return null;

  const ts = activeBriefing
    ? format(new Date(activeBriefing.generatedAt), "EEEE, MMMM d · HH:mm")
    : '';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50"
        onClick={() => setBriefingOpen(false)}
      />

      {/* Modal */}
      <div
        className="fixed inset-y-4 left-1/2 -translate-x-1/2 z-50 flex flex-col rounded border shadow-2xl overflow-hidden"
        style={{
          width: 680,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-3 border-b shrink-0"
          style={{
            background: 'var(--color-navy, #1A1A2E)',
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <div className="flex-1">
            <div
              className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              PVA Intelligence
            </div>
            <div className="text-white font-black text-[16px] tracking-tight">
              PMIP Briefing
            </div>
          </div>

          {/* Window selector */}
          <div className="relative">
            <button
              onClick={() => setWindowMenuOpen(!windowMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-semibold border transition-colors"
              style={{
                borderColor: 'rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.8)',
                background: 'rgba(255,255,255,0.08)',
              }}
            >
              {WINDOW_OPTIONS.find((o) => o.value === windowHours)?.label}
              <ChevronDown size={11} />
            </button>
            {windowMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 rounded border shadow-lg z-10 overflow-hidden"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', minWidth: 110 }}
              >
                {WINDOW_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setWindowHours(opt.value); setWindowMenuOpen(false); }}
                    className="block w-full text-left px-3 py-2 text-[12px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    style={{
                      color: opt.value === windowHours ? 'var(--color-brand)' : 'var(--color-text)',
                      fontWeight: opt.value === windowHours ? 700 : 400,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Regenerate */}
          <button
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-semibold transition-colors disabled:opacity-50"
            style={{ background: 'var(--color-alert)', color: '#fff' }}
          >
            <RefreshCw size={11} className={regenerateMutation.isPending ? 'animate-spin' : ''} />
            <span>Regenerate</span>
          </button>

          <button
            onClick={() => setBriefingOpen(false)}
            className="p-1.5 rounded transition-colors"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Subheader */}
        {activeBriefing && (
          <div
            className="px-5 py-2 border-b text-[11px] flex items-center gap-3 shrink-0"
            style={{
              background: 'var(--color-brand)',
              borderColor: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            <span>{ts}</span>
            <span className="opacity-50">·</span>
            <span>{activeBriefing.topicCount} trending topics · {activeBriefing.storyCount} stories analysed</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading || regenerateMutation.isPending ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <RefreshCw size={24} className="animate-spin mx-auto" style={{ color: 'var(--color-brand)' }} />
                <div className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                  {regenerateMutation.isPending ? 'Generating briefing...' : 'Loading...'}
                </div>
              </div>
            </div>
          ) : !activeBriefing ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-[13px] mb-3" style={{ color: 'var(--color-text-muted)' }}>No briefing available</div>
                <button
                  onClick={() => regenerateMutation.mutate()}
                  className="px-4 py-2 rounded text-[12px] font-semibold"
                  style={{ background: 'var(--color-brand)', color: '#fff' }}
                >
                  Generate Now
                </button>
              </div>
            </div>
          ) : (
            <div className="px-5 py-5 space-y-6">
              {/* Lead narrative */}
              {activeBriefing.content?.leadNarrative && (
                <section>
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-3"
                    style={{ color: 'var(--color-alert)' }}
                  >
                    Lead Narrative
                  </div>
                  <h2
                    className="font-black text-[18px] leading-tight mb-3"
                    style={{ color: 'var(--color-text)', fontFamily: 'Georgia, serif' }}
                  >
                    {activeBriefing.content.leadNarrative.headline}
                  </h2>
                  {activeBriefing.content.leadNarrative.paragraphs?.map((p, i) => (
                    <p key={i} className="text-[13px] leading-relaxed mb-3" style={{ color: 'var(--color-text)' }}>
                      {p}
                    </p>
                  ))}
                  {activeBriefing.content.leadNarrative.citations?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {activeBriefing.content.leadNarrative.citations.map((c, i) => (
                        <a
                          key={i}
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] hover:underline"
                          style={{ color: 'var(--color-brand)' }}
                        >
                          {c.label}
                          <ExternalLink size={9} />
                        </a>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Divider */}
              <div className="border-t" style={{ borderColor: 'var(--color-border)' }} />

              {/* Topic sections */}
              {activeBriefing.content?.sections?.map((section, i) => (
                <section key={i}>
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-3"
                    style={{ color: 'var(--color-alert)' }}
                  >
                    {section.label}
                  </div>
                  <ul className="space-y-2.5">
                    {section.stories?.map((story, j) => (
                      <li key={j} className="flex gap-2 text-[13px]">
                        <span style={{ color: 'var(--color-brand)', fontWeight: 700, flexShrink: 0 }}>·</span>
                        <div>
                          <a
                            href={story.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold hover:underline"
                            style={{ color: 'var(--color-text)' }}
                          >
                            {story.headline}
                          </a>
                          {' '}
                          <span style={{ color: 'var(--color-text-muted)' }}>
                            — {story.summary}
                          </span>
                          {story.sourceCount > 1 && (
                            <span
                              className="ml-1 text-[11px]"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              [{story.sourceCount} sources]
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
