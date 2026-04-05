import { useState } from 'react';
import { X, Plus, Trash2, Globe, Mail, Radio, Loader2, Inbox, Search, ExternalLink } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSources, api } from '../../lib/api';
import type { Source } from '../../lib/api';

interface Props { onClose: () => void; }

type Tab = 'add' | 'scan' | 'discover';

const TYPE_OPTIONS = [
  { value: 'WEB', label: 'Web / RSS', icon: Globe },
  { value: 'NEWSLETTER', label: 'Newsletter', icon: Mail },
  { value: 'PODCAST', label: 'Podcast', icon: Radio },
];

interface DiscoveredNewsletter {
  sender: string; name: string; email: string;
  messageCount: number; lastReceived: string;
  confidence: 'high' | 'medium' | 'low';
}

interface DiscoveredFeed {
  url: string; title: string;
  type: 'rss' | 'atom' | 'json';
  confidence: 'high' | 'medium';
}

function typeIcon(type: string) {
  if (type === 'NEWSLETTER') return <Mail size={13} />;
  if (type === 'PODCAST') return <Radio size={13} />;
  return <Globe size={13} />;
}

function confidenceBadge(c: string) {
  const colors: Record<string, string> = {
    high: 'rgba(5,150,105,0.12)',
    medium: 'rgba(43,58,140,0.1)',
    low: 'rgba(107,107,126,0.1)',
  };
  const text: Record<string, string> = {
    high: 'var(--color-market)',
    medium: 'var(--color-brand)',
    low: 'var(--color-text-muted)',
  };
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
      style={{ background: colors[c] || colors.low, color: text[c] || text.low }}>
      {c}
    </span>
  );
}

export default function SourceManager({ onClose }: Props) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('add');

  // Add tab state
  const [name, setName] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [type, setType] = useState('WEB');
  const [addError, setAddError] = useState('');

  // Scan tab state
  const [newsletters, setNewsletters] = useState<DiscoveredNewsletter[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [scanDemo, setScanDemo] = useState(false);

  // Discover tab state
  const [discoverUrl, setDiscoverUrl] = useState('');
  const [feeds, setFeeds] = useState<DiscoveredFeed[]>([]);
  const [selectedFeeds, setSelectedFeeds] = useState<Set<string>>(new Set());

  const { data, isLoading: sourcesLoading } = useQuery({
    queryKey: ['sources'],
    queryFn: fetchSources,
  });
  const sources = data?.sources || [];

  const addMutation = useMutation({
    mutationFn: (body: any) => api.post('/sources', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      setName(''); setFeedUrl(''); setAddError('');
    },
    onError: (err: any) => setAddError(err.response?.data?.error || 'Failed to add source'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sources/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sources'] }),
  });

  const scanMutation = useMutation({
    mutationFn: () => api.get('/gmail/scan'),
    onSuccess: (res) => {
      setNewsletters(res.data.newsletters || []);
      setScanDemo(res.data.demo || false);
      setSelectedEmails(new Set(res.data.newsletters.filter((n: DiscoveredNewsletter) => n.confidence === 'high').map((n: DiscoveredNewsletter) => n.email)));
    },
  });

  const discoverMutation = useMutation({
    mutationFn: () => api.get('/discover', { params: { url: discoverUrl } }),
    onSuccess: (res) => {
      setFeeds(res.data.feeds || []);
      setSelectedFeeds(new Set(res.data.feeds.map((f: DiscoveredFeed) => f.url)));
    },
  });

  const importNewslettersMutation = useMutation({
    mutationFn: async () => {
      const toImport = newsletters.filter(n => selectedEmails.has(n.email));
      for (const nl of toImport) {
        await api.post('/sources', { name: nl.name, type: 'NEWSLETTER', feedUrl: nl.email, category: 'newsletter' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      setNewsletters([]); setSelectedEmails(new Set());
      setTab('add');
    },
  });

  const importFeedsMutation = useMutation({
    mutationFn: async () => {
      const toImport = feeds.filter(f => selectedFeeds.has(f.url));
      for (const feed of toImport) {
        await api.post('/sources', { name: feed.title, type: 'WEB', feedUrl: feed.url, category: 'web' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      setFeeds([]); setSelectedFeeds(new Set()); setDiscoverUrl('');
      setTab('add');
    },
  });

  const grouped = {
    WEB: sources.filter(s => s.type === 'WEB'),
    NEWSLETTER: sources.filter(s => s.type === 'NEWSLETTER'),
    PODCAST: sources.filter(s => s.type === 'PODCAST'),
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-y-4 left-1/2 -translate-x-1/2 z-50 flex flex-col rounded border shadow-2xl overflow-hidden"
        style={{ width: 600, maxWidth: 'calc(100vw - 32px)', background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="font-bold text-[16px]" style={{ color: 'var(--color-text)' }}>Manage Sources</h2>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {sources.length} sources configured
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--color-text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          {[
            { id: 'add', label: 'Add Source', icon: Plus },
            { id: 'scan', label: 'Scan Gmail', icon: Inbox },
            { id: 'discover', label: 'Find RSS', icon: Search },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-colors"
              style={{
                borderBottomColor: tab === t.id ? 'var(--color-brand)' : 'transparent',
                color: tab === t.id ? 'var(--color-brand)' : 'var(--color-text-muted)',
              }}>
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── ADD TAB ── */}
          {tab === 'add' && (
            <div className="p-5 space-y-5">
              {/* Add form */}
              <div className="p-4 rounded border space-y-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
                <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>New Source</div>
                <div className="flex gap-1.5">
                  {TYPE_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setType(opt.value)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[11px] font-semibold transition-colors"
                      style={{
                        borderColor: type === opt.value ? 'var(--color-brand)' : 'var(--color-border)',
                        background: type === opt.value ? 'rgba(43,58,140,0.08)' : 'transparent',
                        color: type === opt.value ? 'var(--color-brand)' : 'var(--color-text-muted)',
                      }}>
                      <opt.icon size={11} /> {opt.label}
                    </button>
                  ))}
                </div>
                <input type="text" placeholder="Display name (e.g. Semafor DC)"
                  value={name} onChange={e => { setName(e.target.value); setAddError(''); }}
                  className="w-full px-3 py-2 text-[13px] rounded border outline-none"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  onFocus={e => e.target.style.borderColor = 'var(--color-brand)'}
                  onBlur={e => e.target.style.borderColor = 'var(--color-border)'} />
                <input type="text"
                  placeholder={type === 'NEWSLETTER' ? 'Sender email (e.g. washingtondc@semafor.com)' : 'RSS feed URL (e.g. https://example.com/feed)'}
                  value={feedUrl} onChange={e => { setFeedUrl(e.target.value); setAddError(''); }}
                  onKeyDown={e => e.key === 'Enter' && addMutation.mutate({ name, type, feedUrl, category: type.toLowerCase() })}
                  className="w-full px-3 py-2 text-[13px] rounded border outline-none"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  onFocus={e => e.target.style.borderColor = 'var(--color-brand)'}
                  onBlur={e => e.target.style.borderColor = 'var(--color-border)'} />
                {addError && <p className="text-[12px]" style={{ color: 'var(--color-alert)' }}>{addError}</p>}
                <button onClick={() => addMutation.mutate({ name, type, feedUrl, category: type.toLowerCase() })}
                  disabled={addMutation.isPending || !name.trim() || !feedUrl.trim()}
                  className="flex items-center gap-2 px-3 py-2 rounded text-[12px] font-semibold disabled:opacity-50"
                  style={{ background: 'var(--color-brand)', color: '#fff' }}>
                  {addMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Add Source
                </button>
              </div>

              {/* Source list */}
              {(['WEB', 'NEWSLETTER', 'PODCAST'] as const).map(t => {
                const list = grouped[t];
                if (!list.length) return null;
                const labels = { WEB: 'Web Sources', NEWSLETTER: 'Newsletters', PODCAST: 'Podcasts' };
                return (
                  <div key={t}>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>
                      {labels[t]} ({list.length})
                    </div>
                    <div className="space-y-1">
                      {list.map(source => (
                        <SourceRow key={source.id} source={source}
                          onDelete={() => deleteMutation.mutate(source.id)}
                          deleting={deleteMutation.isPending && (deleteMutation.variables as string) === source.id} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── SCAN GMAIL TAB ── */}
          {tab === 'scan' && (
            <div className="p-5 space-y-4">
              {newsletters.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <Inbox size={32} className="mx-auto opacity-20" style={{ color: 'var(--color-text)' }} />
                  <div>
                    <div className="font-semibold text-[14px] mb-1" style={{ color: 'var(--color-text)' }}>
                      Scan your Gmail inbox
                    </div>
                    <div className="text-[12px] max-w-sm mx-auto" style={{ color: 'var(--color-text-muted)' }}>
                      PMIP will look through the last 90 days of email and identify newsletters you're already subscribed to.
                      {!process.env.VITE_GMAIL_CONFIGURED && ' (Demo mode — configure Gmail OAuth to scan your real inbox)'}
                    </div>
                  </div>
                  <button onClick={() => scanMutation.mutate()}
                    disabled={scanMutation.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded text-[13px] font-semibold"
                    style={{ background: 'var(--color-brand)', color: '#fff' }}>
                    {scanMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Scanning inbox...</> : <><Inbox size={14} /> Scan Inbox</>}
                  </button>
                </div>
              ) : (
                <>
                  {scanDemo && (
                    <div className="text-[11px] px-3 py-2 rounded border" style={{ background: 'rgba(43,58,140,0.05)', borderColor: 'rgba(43,58,140,0.2)', color: 'var(--color-brand)' }}>
                      Demo mode — showing example newsletters. Add Gmail OAuth credentials to scan your real inbox.
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] font-semibold" style={{ color: 'var(--color-text)' }}>
                      Found {newsletters.length} newsletters · {selectedEmails.size} selected
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedEmails(new Set(newsletters.map(n => n.email)))}
                        className="text-[11px] px-2 py-1 rounded border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                        Select all
                      </button>
                      <button onClick={() => setSelectedEmails(new Set())}
                        className="text-[11px] px-2 py-1 rounded border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {newsletters.map(nl => {
                      const selected = selectedEmails.has(nl.email);
                      return (
                        <div key={nl.email}
                          className="flex items-center gap-3 px-3 py-2.5 rounded border cursor-pointer transition-colors"
                          style={{ borderColor: selected ? 'var(--color-brand)' : 'var(--color-border)', background: selected ? 'rgba(43,58,140,0.04)' : 'var(--color-surface)' }}
                          onClick={() => {
                            const next = new Set(selectedEmails);
                            if (next.has(nl.email)) next.delete(nl.email); else next.add(nl.email);
                            setSelectedEmails(next);
                          }}>
                          <span className="shrink-0 w-[15px] h-[15px] rounded flex items-center justify-center border"
            style={{ borderColor: selected ? 'var(--color-brand)' : 'var(--color-text-muted)', background: selected ? 'var(--color-brand)' : 'transparent' }}>
            {selected && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium" style={{ color: 'var(--color-text)' }}>{nl.name}</div>
                            <div className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>{nl.email} · {nl.messageCount} emails</div>
                          </div>
                          {confidenceBadge(nl.confidence)}
                        </div>
                      );
                    })}
                  </div>

                  <button onClick={() => importNewslettersMutation.mutate()}
                    disabled={importNewslettersMutation.isPending || selectedEmails.size === 0}
                    className="w-full py-2.5 rounded text-[13px] font-semibold disabled:opacity-50"
                    style={{ background: 'var(--color-brand)', color: '#fff' }}>
                    {importNewslettersMutation.isPending ? 'Importing...' : `Import ${selectedEmails.size} Newsletter${selectedEmails.size !== 1 ? 's' : ''}`}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── DISCOVER RSS TAB ── */}
          {tab === 'discover' && (
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                  Enter a website URL
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="e.g. nytimes.com or https://www.ft.com"
                    value={discoverUrl} onChange={e => setDiscoverUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && discoverUrl.trim() && discoverMutation.mutate()}
                    className="flex-1 px-3 py-2 text-[13px] rounded border outline-none"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    onFocus={e => e.target.style.borderColor = 'var(--color-brand)'}
                    onBlur={e => e.target.style.borderColor = 'var(--color-border)'} />
                  <button onClick={() => discoverMutation.mutate()}
                    disabled={discoverMutation.isPending || !discoverUrl.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded text-[12px] font-semibold disabled:opacity-50"
                    style={{ background: 'var(--color-brand)', color: '#fff' }}>
                    {discoverMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                    Find Feeds
                  </button>
                </div>
              </div>

              {discoverMutation.isError && (
                <div className="text-[12px] px-3 py-2 rounded" style={{ background: 'rgba(232,64,64,0.08)', color: 'var(--color-alert)' }}>
                  Could not reach that URL. Check it's correct and publicly accessible.
                </div>
              )}

              {feeds.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] font-semibold" style={{ color: 'var(--color-text)' }}>
                      Found {feeds.length} feed{feeds.length !== 1 ? 's' : ''} · {selectedFeeds.size} selected
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedFeeds(new Set(feeds.map(f => f.url)))}
                        className="text-[11px] px-2 py-1 rounded border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                        Select all
                      </button>
                      <button onClick={() => setSelectedFeeds(new Set())}
                        className="text-[11px] px-2 py-1 rounded border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {feeds.map(feed => {
                      const selected = selectedFeeds.has(feed.url);
                      return (
                        <div key={feed.url}
                          className="flex items-center gap-3 px-3 py-2.5 rounded border cursor-pointer"
                          style={{ borderColor: selected ? 'var(--color-brand)' : 'var(--color-border)', background: selected ? 'rgba(43,58,140,0.04)' : 'var(--color-surface)' }}
                          onClick={() => {
                            const next = new Set(selectedFeeds);
                            if (next.has(feed.url)) next.delete(feed.url); else next.add(feed.url);
                            setSelectedFeeds(next);
                          }}>
                          <span className="shrink-0 w-[15px] h-[15px] rounded flex items-center justify-center border"
            style={{ borderColor: selected ? 'var(--color-brand)' : 'var(--color-text-muted)', background: selected ? 'var(--color-brand)' : 'transparent' }}>
            {selected && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium" style={{ color: 'var(--color-text)' }}>{feed.title}</div>
                            <div className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>{feed.url}</div>
                          </div>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase shrink-0"
                            style={{ background: 'rgba(43,58,140,0.08)', color: 'var(--color-brand)' }}>
                            {feed.type}
                          </span>
                          {confidenceBadge(feed.confidence)}
                          <a href={feed.url} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="p-1 rounded hover:opacity-70 shrink-0"
                            style={{ color: 'var(--color-text-muted)' }}>
                            <ExternalLink size={11} />
                          </a>
                        </div>
                      );
                    })}
                  </div>

                  <button onClick={() => importFeedsMutation.mutate()}
                    disabled={importFeedsMutation.isPending || selectedFeeds.size === 0}
                    className="w-full py-2.5 rounded text-[13px] font-semibold disabled:opacity-50"
                    style={{ background: 'var(--color-brand)', color: '#fff' }}>
                    {importFeedsMutation.isPending ? 'Importing...' : `Add ${selectedFeeds.size} Feed${selectedFeeds.size !== 1 ? 's' : ''}`}
                  </button>
                </>
              )}

              {feeds.length === 0 && discoverMutation.isSuccess && (
                <div className="text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
                  <div className="text-[13px]">No RSS feeds found at that URL.</div>
                  <div className="text-[11px] mt-1">Try the homepage URL, or add the feed URL manually in the Add Source tab.</div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

function SourceRow({ source, onDelete, deleting }: { source: Source; onDelete: () => void; deleting: boolean }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded border"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{typeIcon(source.type)}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate" style={{ color: 'var(--color-text)' }}>{source.name}</div>
        <div className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>{source.feedUrl}</div>
      </div>
      {source.isAuthenticated && (
        <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(5,150,105,0.1)', color: 'var(--color-market)' }}>Auth</span>
      )}
      {confirming ? (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => { onDelete(); setConfirming(false); }} disabled={deleting}
            className="text-[11px] px-2 py-1 rounded font-semibold"
            style={{ background: 'var(--color-alert)', color: '#fff' }}>
            {deleting ? '...' : 'Remove'}
          </button>
          <button onClick={() => setConfirming(false)} className="text-[11px] px-2 py-1 rounded"
            style={{ color: 'var(--color-text-muted)' }}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)}
          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
          style={{ color: 'var(--color-text-muted)' }} title="Remove source">
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}
