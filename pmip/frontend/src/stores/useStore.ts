import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Story, Cluster, Briefing, Source } from '../lib/api';

interface AppState {
  // Feed state
  stories: Story[];
  setStories: (stories: Story[]) => void;
  updateStory: (id: string, patch: Partial<Story>) => void;

  // Selection
  selectedStory: Story | null;
  setSelectedStory: (story: Story | null) => void;

  // Clusters / filter
  clusters: Cluster[];
  setClusters: (clusters: Cluster[]) => void;
  selectedClusterId: string | null;
  setSelectedClusterId: (id: string | null) => void;

  // Sources
  sources: Source[];
  setSources: (sources: Source[]) => void;
  selectedSourceId: string | null;
  setSelectedSourceId: (id: string | null) => void;

  // View mode
  viewMode: 'feed' | 'starred' | 'newsletters';
  setViewMode: (mode: 'feed' | 'starred' | 'newsletters') => void;

  // Briefing
  briefing: Briefing | null;
  setBriefing: (briefing: Briefing | null) => void;
  briefingOpen: boolean;
  setBriefingOpen: (open: boolean) => void;

  // UI state
  darkMode: boolean;
  toggleDarkMode: () => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Feed
      stories: [],
      setStories: (stories) => set({ stories }),
      updateStory: (id, patch) =>
        set((state) => ({
          stories: state.stories.map((s) => (s.id === id ? { ...s, ...patch } : s)),
          selectedStory:
            state.selectedStory?.id === id
              ? { ...state.selectedStory, ...patch }
              : state.selectedStory,
        })),

      // Selection
      selectedStory: null,
      setSelectedStory: (story) => set({ selectedStory: story }),

      // Clusters
      clusters: [],
      setClusters: (clusters) => set({ clusters }),
      selectedClusterId: null,
      setSelectedClusterId: (id) => set({ selectedClusterId: id }),

      // Sources
      sources: [],
      setSources: (sources) => set({ sources }),
      selectedSourceId: null,
      setSelectedSourceId: (id) => set({ selectedSourceId: id }),

      // View mode
      viewMode: 'feed',
      setViewMode: (viewMode) => set({ viewMode, selectedClusterId: null, selectedSourceId: null }),

      // Briefing
      briefing: null,
      setBriefing: (briefing) => set({ briefing }),
      briefingOpen: false,
      setBriefingOpen: (briefingOpen) => set({ briefingOpen }),

      // UI
      darkMode: false,
      toggleDarkMode: () =>
        set((state) => {
          const next = !state.darkMode;
          if (next) document.documentElement.classList.add('dark');
          else document.documentElement.classList.remove('dark');
          return { darkMode: next };
        }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      searchQuery: '',
      setSearchQuery: (searchQuery) => set({ searchQuery }),
    }),
    {
      name: 'pmip-store',
      partialize: (state) => ({
        darkMode: state.darkMode,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.darkMode) document.documentElement.classList.add('dark');
      },
    }
  )
);
