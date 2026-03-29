import { Search, RefreshCw, Star, Moon, Sun, PanelLeft, Newspaper } from 'lucide-react';
import { useStore } from '../../stores/useStore';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

export default function TopBar() {
  const {
    darkMode, toggleDarkMode,
    toggleSidebar,
    setBriefingOpen, briefing,
    searchQuery, setSearchQuery,
    viewMode, setViewMode,
  } = useStore();

  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setRefreshing(false), 800);
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
      </div>
    </header>
  );
}
