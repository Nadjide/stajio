import { useCallback, useEffect, useState } from 'react';
import { api } from './services/api';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Logo } from './components/Logo';
import {
  BookOpen,
  Calendar,
  History,
  LayoutDashboard,
  LogOut,
  Plus,
  Sparkles,
  Loader2,
  HelpCircle,
  Info,
  UserCircle,
  User as UserIcon,
  Moon,
  Sun,
  MessageCircle
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useTheme } from './hooks/useTheme';
import type { Deadline, LogEntry, User, UserProfile } from './types/models';
import { AuthPage } from './components/auth/AuthPage';
import { ProfileSetupPage } from './components/auth/ProfileSetupPage';
import { TutorialTab } from './components/info/TutorialTab';
import { FAQTab } from './components/info/FAQTab';
import { ProfileTab } from './components/profile/ProfileTab';
import { DashboardTab } from './components/dashboard/DashboardTab';
import { JournalTab } from './components/journal/JournalTab';
import { DeadlinesTab } from './components/deadlines/DeadlinesTab';
import { TimelineTab } from './components/timeline/TimelineTab';
import { ToolsTab } from './components/tools/ToolsTab';
import { AssistantTab } from './components/assistant/AssistantTab';
import { ToastProvider } from './components/ui/Toast';

type TabId =
  | 'dashboard'
  | 'journal'
  | 'timeline'
  | 'deadlines'
  | 'tools'
  | 'assistant'
  | 'tutorial'
  | 'faq'
  | 'profile';

const NAV_ITEMS: Array<{ id: TabId; label: string; icon: React.ReactNode; section?: string }> = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'journal', label: 'Journal de bord', icon: <BookOpen className="w-5 h-5" /> },
  { id: 'timeline', label: 'Timeline', icon: <History className="w-5 h-5" /> },
  { id: 'deadlines', label: 'Deadlines', icon: <Calendar className="w-5 h-5" /> },
  { id: 'tools', label: 'Outils IA', icon: <Sparkles className="w-5 h-5" /> },
  { id: 'assistant', label: 'Assistant IA', icon: <MessageCircle className="w-5 h-5" /> },
  { id: 'tutorial', label: 'Comment ça marche', icon: <Info className="w-5 h-5" />, section: 'Aide & Plus' },
  { id: 'faq', label: 'FAQ', icon: <HelpCircle className="w-5 h-5" /> },
  { id: 'profile', label: 'Mon Profil', icon: <UserCircle className="w-5 h-5" /> }
];

const Dashboard = ({ user, profile, onProfileUpdate, onLogout }: { user: User, profile: UserProfile, onProfileUpdate: (p: UserProfile) => void, onLogout: () => void }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const { theme, toggleTheme } = useTheme('light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [logsData, deadlinesData] = await Promise.all([
        api.logs.list(),
        api.deadlines.list()
      ]);
      setLogs(logsData);
      setDeadlines(deadlinesData);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, []);

  useEffect(() => {
    // Chargement initial: les setState arrivent après les await, pas de rendu en cascade
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const navigate = (tab: TabId) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col lg:flex-row transition-colors duration-200">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 p-4 flex items-center justify-between sticky top-0 z-30 transition-colors duration-200">
        <div className="flex items-center gap-2">
          <Logo className="w-8 h-8" />
          <span className="text-lg font-bold text-stone-900 dark:text-white tracking-tight">Stajio</span>
        </div>
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-lg"
        >
          <LayoutDashboard className="w-6 h-6" />
        </button>
      </header>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:h-screen overflow-y-auto
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Mobile Sidebar Close Header */}
        <div className="lg:hidden p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo className="w-8 h-8" />
            <span className="text-lg font-bold text-stone-900 dark:text-white tracking-tight">Stajio</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-lg"
          >
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <div className="p-8">
          <div className="hidden lg:flex items-center gap-3 mb-12">
            <Logo className="w-10 h-10" />
            <span className="text-xl font-bold text-stone-900 dark:text-white tracking-tight">Stajio</span>
          </div>

          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => (
              <div key={item.id}>
                {item.section && (
                  <div className="pt-4 pb-2">
                    <p className="px-4 text-xs font-semibold text-stone-400 uppercase tracking-wider dark:text-stone-500">{item.section}</p>
                  </div>
                )}
                <button
                  onClick={() => navigate(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-emerald-50 text-emerald-700 font-medium dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800'}`}
                >
                  {item.icon}
                  {item.label}
                </button>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-stone-100 dark:border-stone-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center shrink-0">
                <UserIcon className="text-stone-500 dark:text-stone-400 w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-900 dark:text-white truncate">{profile.displayName}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{profile.company}</p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800 rounded-lg shrink-0"
              title="Changer de thème"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-stone-500 hover:bg-red-50 hover:text-red-600 dark:text-stone-400 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 lg:p-12 overflow-y-auto w-full min-w-0">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <DashboardTab
              key="dashboard"
              profile={profile}
              logs={logs}
              deadlines={deadlines}
              onNavigate={navigate}
            />
          )}
          {activeTab === 'journal' && (
            <JournalTab key="journal" profile={profile} logs={logs} onRefresh={fetchData} />
          )}
          {activeTab === 'timeline' && (
            <TimelineTab key="timeline" profile={profile} logs={logs} deadlines={deadlines} />
          )}
          {activeTab === 'deadlines' && (
            <DeadlinesTab key="deadlines" deadlines={deadlines} onRefresh={fetchData} />
          )}
          {activeTab === 'tools' && <ToolsTab key="tools" profile={profile} logs={logs} />}
          {activeTab === 'assistant' && <AssistantTab key="assistant" profile={profile} logs={logs} />}
          {activeTab === 'tutorial' && <TutorialTab key="tutorial" />}
          {activeTab === 'faq' && <FAQTab key="faq" />}
          {activeTab === 'profile' && (
            <ProfileTab
              key="profile"
              profile={profile}
              user={user}
              onUpdate={(p) => onProfileUpdate(p)}
              onDataImported={fetchData}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api.auth.me();
        if (res.user) {
          setUser(res.user);
          const profileData = await api.profile.get();
          if (profileData && profileData.school) {
            setProfile(profileData);
          }
        }
      } catch (error) {
        console.error("Auth Check Error:", error);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
    await api.auth.logout();
    setUser(null);
    setProfile(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950">
        <Loader2 className="w-12 h-12 text-emerald-600 dark:text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        {!user ? (
          <AuthPage onLogin={(u) => setUser(u)} />
        ) : !profile ? (
          <ProfileSetupPage user={user} onComplete={async () => {
            const p = await api.profile.get();
            setProfile(p);
          }} />
        ) : (
          <Dashboard
            user={user}
            profile={profile}
            onProfileUpdate={(p) => setProfile(p)}
            onLogout={handleLogout}
          />
        )}
      </ToastProvider>
    </ErrorBoundary>
  );
}
