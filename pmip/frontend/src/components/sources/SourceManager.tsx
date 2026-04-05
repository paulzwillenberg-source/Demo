import { useState } from 'react';
import { X, Plus, Trash2, Globe, Mail, Radio, Loader2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSources, api } from '../../lib/api';
import type { Source } from '../../lib/api';

interface Props {
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { value: 'WEB', label: 'Web Source (RSS)', icon: Globe },
  { value: 'NEWSLETTER', label: 'Newsletter (Gmail sender)', icon: Mail },
  { value: 'PODCAST', label: 'Podcast (RSS)', icon: Radio },
];

function typeIcon(type: string) {
  if (type === 'NEWSLETTER') return <Mail size={13} />;
  if (type === 'PODCAST') return <Radio size={13} />;
  return <Globe size={13} />;
}

export default function SourceManager({ onClose }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [type, setType] = useState('WEB');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sources'],
    queryFn: fetchSources,
  });

  const sources = data?.sources || [];

  const addMutation = useMutation({
    mutationFn: () => api.post('/sources', { name, type, feedUrl, category: type.toLowerCase() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      setName(''); setFeedUrl(''); setError('');
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to add source'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sources/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sources'] }),
  });

  const handleAdd = () => {
    if (!name.trim() || !feedUrl.trim()) {
      setError('Name and URL/address are required');
      return;
    }
    addMutation.mutate();
  };

  const grouped = {
    WEB: sources.filter(s => s.type === 'WEB'),
    NEWSLETTER: sources.filter(s => s.type === 'NEWSLETTER'),
    PODCAST: sources.filter(s => s.type === 'PODCAST'),
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40" onClick={onClose} />
      <div
        className="fixed inset-y-4 left-1/2 -translate-x-1/2 z-50 flex flex-col rounded border shadow-2xl overflow-hidden"
        style={{ width: 560, maxWidth: 'calc(100vw - 32px)', background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="font-bold text-[16px]" style={{ color: 'var(--color-text)' }}>Manage Sources</h2>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Add or remove news sources, newsletters, and podcasts
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--color-text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Add new source */}
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
            <div className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>
              Add New Source
            </div>
            <div className="space-y-2">
              {/* Type selector */}
              <div className="flex gap-1.5">
                {TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setType(opt.value)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[11px] font-semibold transition-colors"
                    style={{
                      borderColor: type === opt.value ? 'var(--color-brand)' : 'var(--color-border)',
                      background: type === opt.value ? 'rgba(43,58,140,0.08)' : 'transparent',
                      color: type === opt.value ? 'var(--color-brand)' : 'var(--color-text-muted)',
                    }}
                  >
                    <opt.icon size={11} />
                    {opt.label.split(' ')[0]}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Display name (e.g. Bloomberg Tech)"
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                className="w-full px-3 py-2 text-[13px] rounded border outline-none"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                onFocus={e => e.target.style.borderColor = 'var(--color-brand)'}
                onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
              />

              <input
                type="text"
                placeholder={type === 'NEWSLETTER' ? 'Sender email address (e.g. hello@example.com)' : 'RSS feed URL (e.g. https://example.com/feed.xml)'}
                value={feedUrl}
                onChange={e => { setFeedUrl(e.target.value); setError(''); }}
                className="w-full px-3 py-2 text-[13px] rounded border outline-none"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                onFocus={e => e.target.style.borderColor = 'var(--color-brand)'}
                onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />

              {error && (
                <p className="text-[12px]" style={{ color: 'var(--color-alert)' }}>{error}</p>
              )}

              <button
                onClick={handleAdd}
                disabled={addMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 rounded text-[12px] font-semibold transition-colors disabled:opacity-50"
                style={{ background: 'var(--color-brand)', color: '#fff' }}
              >
                {addMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Add Source
              </button>
            </div>
          </div>

          {/* Source list */}
          <div className="px-5 py-4 space-y-5">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
              </div>
            ) : (
              (['WEB', 'NEWSLETTER', 'PODCAST'] as const).map(t => {
                const list = grouped[t];
                if (list.length === 0) return null;
                const labels = { WEB: 'Web Sources', NEWSLETTER: 'Newsletters', PODCAST: 'Podcasts' };
                return (
                  <div key={t}>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>
                      {labels[t]} ({list.length})
                    </div>
                    <div className="space-y-1">
                      {list.map(source => (
                        <SourceRow
                          key={source.id}
                          source={source}
                          onDelete={() => deleteMutation.mutate(source.id)}
                          deleting={deleteMutation.isPending && deleteMutation.variables === source.id}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function SourceRow({ source, onDelete, deleting }: { source: Source; onDelete: () => void; deleting: boolean }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded border"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <span style={{ color: 'var(--color-text-muted)' }}>{typeIcon(source.type)}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate" style={{ color: 'var(--color-text)' }}>{source.name}</div>
        <div className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>{source.feedUrl}</div>
      </div>
      {source.isAuthenticated && (
        <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(5,150,105,0.1)', color: 'var(--color-market)' }}>
          Auth
        </span>
      )}
      {confirming ? (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { onDelete(); setConfirming(false); }}
            disabled={deleting}
            className="text-[11px] px-2 py-1 rounded font-semibold"
            style={{ background: 'var(--color-alert)', color: '#fff' }}
          >
            {deleting ? '...' : 'Remove'}
          </button>
          <button onClick={() => setConfirming(false)} className="text-[11px] px-2 py-1 rounded" style={{ color: 'var(--color-text-muted)' }}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
          style={{ color: 'var(--color-text-muted)' }}
          title="Remove source"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}
