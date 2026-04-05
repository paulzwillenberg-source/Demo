import React, { useState } from 'react';
import { Home, Star, Mail, Radio, Globe, ChevronDown, ChevronRight, Lock, Settings } from 'lucide-react';
import { useStore } from '../../stores/useStore';
import { useQuery } from '@tanstack/react-query';
import { fetchSources, type Source } from '../../lib/api';
import SourceManager from '../sources/SourceManager';

function groupSources(sources: Source[]) {
  const web = sources.filter(s => s.type === 'WEB').sort((a, b) => a.name.localeCompare(b.name));
  const newsletters = sources.filter(s => s.type === 'NEWSLETTER').sort((a, b) => a.name.localeCompare(b.name));
  const podcasts = sources.filter(s => s.type === 'PODCAST').sort((a, b) => a.name.localeCompare(b.name));
  const paywalled = web.filter(s => s.isAuthenticated);
  return { web: web.filter(s => !s.isAuthenticated), paywalled, newsletters, podcasts };
}

interface SidebarGroupProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
}

function SidebarGroup({ title, icon, children, defaultOpen = true, count }: SidebarGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold tracking-widest uppercase hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        {count !== undefined && <span className="text-[10px] font-normal opacity-60">{count}</span>}
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && <div className="mt-0.5">{children}</div>}
    </div>
  );
}

interface NavItemProps {
  label: string;
  active?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  isAuthenticated?: boolean;
}

function NavItem({ label, active, onClick, icon, isAuthenticated }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] rounded transition-colors text-left"
      style={{
        color: active ? 'var(--color-brand)' : 'var(--color-text)',
        background: active ? 'rgba(43,58,140,0.08)' : undefined,
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {icon && <span className="opacity-50 shrink-0">{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {isAuthenticated && <Lock size={10} className="opacity-30 shrink-0" />}
    </button>
  );
}

export default function Sidebar() {
  const { viewMode, setViewMode, selectedSourceId, setSelectedSourceId, setSelectedClusterId, sidebarCollapsed } = useStore();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);

  const { data: sourcesData } = useQuery({
    queryKey: ['sources'],
    queryFn: fetchSources,
  });

  const sources = sourcesData?.sources || [];
  const { web, paywalled, newsletters, podcasts } = groupSources(sources);

  const handleSourceClick = (sourceId: string) => {
    setSelectedSourceId(sourceId);
    setSelectedClusterId(null);
    setViewMode('feed');
  };

  if (sidebarCollapsed) return null;

  return (
    <>
      <aside
        className="flex-shrink-0 flex flex-col border-r overflow-y-auto"
        style={{ width: 220, background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {/* Logo */}
        <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded flex items-center justify-center text-white text-xs font-black"
              style={{ background: 'var(--color-brand)' }}
            >
              P
            </div>
            <div>
              <div className="font-black text-sm tracking-tight" style={{ color: 'var(--color-text)' }}>PMIP</div>
              <div className="text-[9px] uppercase tracking-widest opacity-40" style={{ color: 'var(--color-text)' }}>Intelligence</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {/* Primary navigation */}
          <NavItem
            label="Home Feed"
            icon={<Home size={13} />}
            active={viewMode === 'feed' && !selectedSourceId}
            onClick={() => { setViewMode('feed'); setSelectedSourceId(null); setSelectedClusterId(null); }}
          />
          <NavItem
            label="Starred"
            icon={<Star size={13} />}
            active={viewMode === 'starred'}
            onClick={() => setViewMode('starred')}
          />
          <NavItem
            label="Newsletters"
            icon={<Mail size={13} />}
            active={viewMode === 'newsletters'}
            onClick={() => setViewMode('newsletters')}
          />

          <div className="my-2 border-t" style={{ borderColor: 'var(--color-border)' }} />

          {/* Web sources */}
          <SidebarGroup title="Web Sources" icon={<Globe size={11} />} count={web.length + paywalled.length}>
            {web.map(s => (
              <NavItem key={s.id} label={s.name} active={selectedSourceId === s.id} onClick={() => handleSourceClick(s.id)} />
            ))}
          </SidebarGroup>

          {/* Newsletters */}
          {newsletters.length > 0 && (
            <SidebarGroup title="Newsletters" icon={<Mail size={11} />} count={newsletters.length}>
              {newsletters.map(s => (
                <NavItem key={s.id} label={s.name} active={selectedSourceId === s.id} onClick={() => handleSourceClick(s.id)} />
              ))}
            </SidebarGroup>
          )}

          {/* Podcasts */}
          {podcasts.length > 0 && (
            <SidebarGroup title="Podcasts" icon={<Radio size={11} />} count={podcasts.length} defaultOpen={false}>
              {podcasts.map(s => (
                <NavItem key={s.id} label={s.name} active={selectedSourceId === s.id} onClick={() => handleSourceClick(s.id)} />
              ))}
            </SidebarGroup>
          )}

          {/* Paywall Auth */}
          {paywalled.length > 0 && (
            <div className="mb-1">
              <button
                onClick={() => setPaywallOpen(!paywallOpen)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold tracking-widest uppercase hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <Lock size={11} />
                <span className="flex-1 text-left">Paywall Auth</span>
                <span className="text-[10px] font-normal opacity-60">{paywalled.length}</span>
                {paywallOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              {paywallOpen && paywalled.map(s => (
                <NavItem key={s.id} label={s.name} active={selectedSourceId === s.id} onClick={() => handleSourceClick(s.id)} isAuthenticated />
              ))}
            </div>
          )}
        </nav>

        {/* Footer — Manage Sources */}
        <div className="px-2 py-2 border-t space-y-1" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={() => setManagerOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-[12px] transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Settings size={13} />
            Manage Sources
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1">
            <div className="live-dot" />
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Live — syncing every 5 min</span>
          </div>
        </div>
      </aside>

      {/* Source manager modal */}
      {managerOpen && <SourceManager onClose={() => setManagerOpen(false)} />}
    </>
  );
}
