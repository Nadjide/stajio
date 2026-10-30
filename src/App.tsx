import { useCallback, useEffect, useState } from "react";
import { api } from "./services/api";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Logo } from "./components/Logo";
import {
  Award,
  BookOpen,
  Calendar,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Sparkles,
  Loader2,
  HelpCircle,
  Info,
  UserCircle,
  User as UserIcon,
  Moon,
  Sun,
  MessageCircle,
  X,
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useTheme } from "./hooks/useTheme";
import { flushAllDrafts } from "./hooks/useDraft";
import type { Deadline, LogEntry, Skill, User, UserProfile } from "./types/models";
import { AuthPage } from "./components/auth/AuthPage";
import { ProfileSetupPage } from "./components/auth/ProfileSetupPage";
import { TutorialTab } from "./components/info/TutorialTab";
import { FAQTab } from "./components/info/FAQTab";
import { ProfileTab } from "./components/profile/ProfileTab";
import { DashboardTab } from "./components/dashboard/DashboardTab";
import { JournalTab, type DataStatus } from "./components/journal/JournalTab";
import { DeadlinesTab } from "./components/deadlines/DeadlinesTab";
import { TimelineTab } from "./components/timeline/TimelineTab";
import { ToolsTab } from "./components/tools/ToolsTab";
import { AssistantTab } from "./components/assistant/AssistantTab";
import { SkillsTab } from "./components/skills/SkillsTab";
import { ReportTab } from "./components/report/ReportTab";
import { ToastProvider } from "./components/ui/Toast";
import { isProfileComplete } from "./utils/profile";

export type TabId =
  | "dashboard"
  | "journal"
  | "skills"
  | "timeline"
  | "deadlines"
  | "report"
  | "tools"
  | "assistant"
  | "tutorial"
  | "faq"
  | "profile";

const NAV_ITEMS: Array<{ id: TabId; label: string; icon: React.ReactNode; section?: string }> = [
  { id: "dashboard", label: "Tableau de bord", icon: <LayoutDashboard className="h-5 w-5" aria-hidden /> },
  { id: "journal", label: "Journal de bord", icon: <BookOpen className="h-5 w-5" aria-hidden /> },
  { id: "skills", label: "Compétences", icon: <Award className="h-5 w-5" aria-hidden /> },
  { id: "timeline", label: "Timeline", icon: <History className="h-5 w-5" aria-hidden /> },
  { id: "deadlines", label: "Échéances", icon: <Calendar className="h-5 w-5" aria-hidden /> },
  { id: "report", label: "Rapport", icon: <FileText className="h-5 w-5" aria-hidden /> },
  { id: "tools", label: "Outils IA", icon: <Sparkles className="h-5 w-5" aria-hidden /> },
  { id: "assistant", label: "Assistant IA", icon: <MessageCircle className="h-5 w-5" aria-hidden /> },
  {
    id: "tutorial",
    label: "Comment ça marche",
    icon: <Info className="h-5 w-5" aria-hidden />,
    section: "Aide & Plus",
  },
  { id: "faq", label: "FAQ", icon: <HelpCircle className="h-5 w-5" aria-hidden /> },
  { id: "profile", label: "Mon Profil", icon: <UserCircle className="h-5 w-5" aria-hidden /> },
];

const Dashboard = ({
  user,
  profile,
  onProfileUpdate,
  onLogout,
  onAccountDeleted,
}: {
  user: User;
  profile: UserProfile;
  onProfileUpdate: (p: UserProfile | null) => void;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => void;
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [status, setStatus] = useState<DataStatus>("loading");
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const { theme, toggleTheme } = useTheme("light");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Data already on screen stays visible during a refresh; only a first load shows "loading".
  const fetchData = useCallback(async () => {
    try {
      const [logsData, deadlinesData, skillsData] = await Promise.all([
        api.logs.list(),
        api.deadlines.list(),
        api.skills.list(),
      ]);
      setLogs(logsData);
      setDeadlines(deadlinesData);
      setSkills(skillsData);
      setStatus("ready");
    } catch {
      setStatus((previous) => (previous === "ready" ? previous : "error"));
    }
  }, []);

  const fetchSkills = useCallback(async () => {
    setSkills(await api.skills.list());
  }, []);

  const refreshRestoredData = async () => {
    const [restoredProfile] = await Promise.all([api.profile.get(), fetchData()]);
    onProfileUpdate(restoredProfile);
  };

  useEffect(() => {
    // Chargement initial: les setState arrivent après les await, pas de rendu en cascade
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const navigate = (tab: TabId) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  const logout = async () => {
    setLoggingOut(true);
    await onLogout();
  };

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 transition-colors duration-200 lg:flex-row dark:bg-stone-950">
      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200 bg-white p-4 transition-colors duration-200 lg:hidden dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="text-lg font-bold tracking-tight text-stone-900 dark:text-white">Stajio</span>
        </div>
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={isSidebarOpen}
          className="rounded-lg p-2 text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800"
        >
          <Menu className="h-6 w-6" aria-hidden />
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-y-auto border-r border-stone-200 bg-white transition-transform duration-300 lg:static lg:h-screen lg:translate-x-0 dark:border-stone-800 dark:bg-stone-900 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} `}
      >
        {/* Mobile Sidebar Close Header */}
        <div className="flex items-center justify-between border-b border-stone-100 p-6 lg:hidden dark:border-stone-800">
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight text-stone-900 dark:text-white">Stajio</span>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Fermer le menu"
            className="rounded-lg p-2 text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            <X className="h-6 w-6" aria-hidden />
          </button>
        </div>

        <div className="p-8">
          <div className="mb-12 hidden items-center gap-3 lg:flex">
            <Logo className="h-10 w-10" />
            <span className="text-xl font-bold tracking-tight text-stone-900 dark:text-white">Stajio</span>
          </div>

          <nav className="space-y-2" aria-label="Navigation principale">
            {NAV_ITEMS.map((item) => (
              <div key={item.id}>
                {item.section && (
                  <div className="pt-4 pb-2">
                    <p className="px-4 text-xs font-semibold tracking-wider text-stone-400 uppercase dark:text-stone-500">
                      {item.section}
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => navigate(item.id)}
                  aria-current={activeTab === item.id ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all ${activeTab === item.id ? "bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800"}`}
                >
                  {item.icon}
                  {item.label}
                </button>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-auto border-t border-stone-100 p-8 dark:border-stone-800">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
                <UserIcon className="h-5 w-5 text-stone-500 dark:text-stone-400" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-900 dark:text-white">{profile.displayName}</p>
                <p className="truncate text-xs text-stone-500 dark:text-stone-400">{profile.company}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="shrink-0 rounded-lg p-2 text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
              title="Changer de thème"
              aria-label={theme === "light" ? "Passer au thème sombre" : "Passer au thème clair"}
            >
              {theme === "light" ? <Moon className="h-5 w-5" aria-hidden /> : <Sun className="h-5 w-5" aria-hidden />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-stone-500 transition-all hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-stone-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          >
            {loggingOut ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <LogOut className="h-5 w-5" aria-hidden />
            )}
            Déconnexion
          </button>
          <p className="mt-2 px-4 text-xs text-stone-400 dark:text-stone-500">
            Tes brouillons sont enregistrés avec ton compte et seront proposés à ta prochaine connexion.
          </p>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="w-full min-w-0 flex-1 overflow-y-auto p-4 md:p-8 lg:p-12">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <DashboardTab
              key="dashboard"
              profile={profile}
              logs={logs}
              deadlines={deadlines}
              skills={skills}
              status={status}
              onRetry={fetchData}
              onNavigate={navigate}
            />
          )}
          {activeTab === "journal" && (
            <JournalTab
              key="journal"
              profile={profile}
              logs={logs}
              skills={skills}
              status={status}
              onRefresh={fetchData}
              onSkillsChanged={fetchSkills}
            />
          )}
          {activeTab === "skills" && (
            <SkillsTab key="skills" profile={profile} logs={logs} skills={skills} onChanged={fetchSkills} />
          )}
          {activeTab === "timeline" && (
            <TimelineTab key="timeline" profile={profile} logs={logs} deadlines={deadlines} skills={skills} />
          )}
          {activeTab === "deadlines" && <DeadlinesTab key="deadlines" deadlines={deadlines} onRefresh={fetchData} />}
          {activeTab === "report" && <ReportTab key="report" profile={profile} logs={logs} />}
          {activeTab === "tools" && <ToolsTab key="tools" logs={logs} onNavigate={navigate} />}
          {activeTab === "assistant" && <AssistantTab key="assistant" logs={logs} />}
          {activeTab === "tutorial" && <TutorialTab key="tutorial" />}
          {activeTab === "faq" && <FAQTab key="faq" />}
          {activeTab === "profile" && (
            <ProfileTab
              key={JSON.stringify(profile)}
              profile={profile}
              user={user}
              onUpdate={(p) => onProfileUpdate(p)}
              onDataImported={refreshRestoredData}
              onAccountDeleted={onAccountDeleted}
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
          if (isProfileComplete(profileData)) {
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

  const handleLogin = async (loggedInUser: User) => {
    setUser(loggedInUser);
    try {
      const profileData = await api.profile.get();
      if (isProfileComplete(profileData)) {
        setProfile(profileData);
      }
    } catch (error) {
      console.error("Profile Fetch Error:", error);
    }
  };

  // Pending drafts are saved to this account before the session ends.
  const handleLogout = async () => {
    await flushAllDrafts();
    await api.auth.logout();
    setUser(null);
    setProfile(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-stone-950" role="status">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-600 dark:text-emerald-500" aria-label="Chargement" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        {!user ? (
          <AuthPage onLogin={handleLogin} />
        ) : !profile ? (
          <ProfileSetupPage
            key={user.uid}
            user={user}
            onComplete={async () => {
              const p = await api.profile.get();
              setProfile(isProfileComplete(p) ? p : null);
            }}
          />
        ) : (
          <Dashboard
            key={user.uid}
            user={user}
            profile={profile}
            onProfileUpdate={(p) => {
              setProfile(isProfileComplete(p) ? p : null);
              if (p?.displayName)
                setUser((previous) => (previous ? { ...previous, displayName: p.displayName } : previous));
            }}
            onLogout={handleLogout}
            onAccountDeleted={() => {
              setUser(null);
              setProfile(null);
            }}
          />
        )}
      </ToastProvider>
    </ErrorBoundary>
  );
}
