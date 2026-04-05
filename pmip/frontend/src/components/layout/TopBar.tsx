import { Search, RefreshCw, Star, Moon, Sun, PanelLeft, Newspaper, LogOut, ChevronDown, Sparkles } from 'lucide-react';
import { useStore } from '../../stores/useStore';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import { api } from '../../lib/api';

export default function TopBar() {
  const {
    darkMode, toggleDarkMode,
    toggleSidebar,
    setBriefingOpen, briefing,
    searchQuery, setSearchQuery,
    viewMode, setViewMode,
    user, logout,
  } = useStore();

  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    try {
      await api.post('/briefings/summarize-backfill', { limit: 30 });
      // Refresh feed after ~15s to pick up new summaries
      setTimeout(async () => {
        await queryClient.invalidateQueries({ queryKey: ['stories'] });
        setSummarizing(false);
      }, 15000);
    } catch {
      setSummarizing(false);
    }
  };

  return (
    <header
      className="flex items-center gap-3 px-4 border-b shrink-0"
      style={{
        height: 48,
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        title="Toggle sidebar"
      >
        <PanelLeft size={16} />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-sm relative">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--color-text-muted)' }}
        />
        <input
          type="text"
          placeholder="Search stories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-7 pr-3 py-1.5 text-[13px] rounded border outline-none transition-colors"
          style={{
            background: 'var(--color-bg)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text)',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--color-brand)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
        />
      </div>

      <div className="flex-1" />

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {/* Briefing button */}
        <button
          onClick={() => setBriefingOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold transition-colors"
          style={{
            background: 'var(--color-brand)',
            color: '#fff',
          }}
          title="Open macro briefing"
        >
          <Newspaper size={13} />
          <span className="hidden sm:inline">Briefing</span>
          {briefing && (
            <span
              className="w-1.5 h-1.5 rounded-full ml-0.5"
              style={{ background: 'var(--color-alert)' }}
            />
          )}
        </button>

        {/* Starred */}
        <button
          onClick={() => setViewMode('starred')}
          className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          style={{ color: viewMode === 'starred' ? 'var(--color-star)' : 'var(--color-text-muted)' }}
          title="Starred stories"
        >
          <Star size={16} fill={viewMode === 'starred' ? 'currentColor' : 'none'} />
        </button>

        {/* Summarize unsummarized stories */}
        <button
          onClick={handleSummarize}
          disabled={summarizing}
          className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
          style={{ color: summarizing ? 'var(--color-brand)' : 'var(--color-text-muted)' }}
          title={summarizing ? 'Summarizing stories… (refreshes in ~15s)' : 'Summarize stories with AI'}
        >
          <Sparkles size={16} className={summarizing ? 'animate-pulse' : ''} />
        </button>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          title="Refresh feed"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>

        {/* Dark mode */}
        <button
          onClick={toggleDarkMode}
          className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          title="Toggle dark mode"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* User menu */}
        {user && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors ml-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ background: 'var(--color-brand)' }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-[12px] font-medium hidden sm:block" style={{ color: 'var(--color-text)' }}>
                {user.name.split(' ')[0]}
              </span>
              <ChevronDown size={12} />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border shadow-lg z-50 py-1"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="text-[12px] font-semibold" style={{ color: 'var(--color-text)' }}>{user.name}</div>
                  <div className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>{user.email}</div>
                </div>
                <button
                  onClick={() => { logout(); setUserMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  style={{ color: 'var(--color-alert)' }}
                >
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
