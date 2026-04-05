import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStore } from './stores/useStore';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import TopicFilterBar from './components/layout/TopicFilterBar';
import FeedGrid from './components/feed/FeedGrid';
import StoryPanel from './components/feed/StoryPanel';
import BriefingModal from './components/briefing/BriefingModal';
import AuthPage from './components/auth/AuthPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function AppInner() {
  const { darkMode, selectedStory, user } = useStore();

  // Sync dark mode class on mount
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // Show auth page when not logged in
  if (!user) {
    return <AuthPage />;
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Left sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <TopBar />

        {/* Topic filter bar */}
        <TopicFilterBar />

        {/* Feed */}
        <FeedGrid />
      </div>

      {/* Right slide-over: story detail */}
      {selectedStory && <StoryPanel />}

      {/* Briefing modal */}
      <BriefingModal />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}
