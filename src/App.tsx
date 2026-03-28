import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  structureLog, 
  generateReport, 
  prepareDefense, 
  generateCVPoints
} from './services/gemini';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Logo } from './components/Logo';
import { 
  BookOpen, 
  Calendar, 
  FileText, 
  GraduationCap, 
  LayoutDashboard, 
  LogOut, 
  Plus, 
  Send, 
  Settings, 
  CheckCircle2, 
  Circle, 
  Loader2, 
  ChevronRight, 
  Briefcase, 
  Download, 
  Sparkles,
  User as UserIcon,
  Trash2,
  Copy,
  Printer,
  HelpCircle,
  Info,
  UserCircle,
  Moon,
  Sun,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInWeeks, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import Markdown from 'react-markdown';
import { useTheme } from './hooks/useTheme';
import { useClipboard } from './hooks/useClipboard';
import type { Deadline, LogEntry, User, UserProfile } from './types/models';
import { AuthPage } from './components/auth/AuthPage';
import { ProfileSetupPage } from './components/auth/ProfileSetupPage';
import { TutorialTab } from './components/info/TutorialTab';
import { FAQTab } from './components/info/FAQTab';
import { ProfileTab } from './components/profile/ProfileTab';

// --- Components ---

const Dashboard = ({ user, profile, onProfileUpdate, onLogout }: { user: User, profile: UserProfile, onProfileUpdate: (p: UserProfile) => void, onLogout: () => void }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [activeTab, setActiveTab] = useState<'journal' | 'deadlines' | 'tools' | 'tutorial' | 'faq' | 'profile'>('journal');
  const { theme, toggleTheme } = useTheme('light');
  const [isLogging, setIsLogging] = useState(false);
  const [newLog, setNewLog] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

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
    fetchData();
    // In a real app with WebSockets, we'd subscribe here. 
    // For SQLite tests, we'll just poll or refresh after actions.
  }, [fetchData]);

  const handleAddLog = async () => {
    if (!newLog.trim()) return;
    setLoadingAI(true);
    try {
      const structured = await structureLog(newLog);
      const weekNumber = differenceInWeeks(new Date(), parseISO(profile.internshipStart)) + 1;
      
      await api.logs.add({
        date: format(new Date(), 'yyyy-MM-dd'),
        rawContent: newLog,
        structuredContent: structured.summary,
        summary: structured.summary,
        missions: structured.missions,
        technologies: structured.technologies,
        skills: structured.skills,
        weekNumber
      });
      
      setNewLog("");
      setIsLogging(false);
      fetchData();
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setLoadingAI(false);
    }
  };

  const toggleDeadline = async (id: string, completed: boolean) => {
    try {
      await api.deadlines.update(id, !completed);
      fetchData();
    } catch (error) {
      console.error("Error updating deadline:", error);
    }
  };

  const deleteLog = async (id: string) => {
    try {
      await api.logs.delete(id);
      fetchData();
    } catch (error) {
      console.error("Error deleting log:", error);
    }
  };

  const runAITool = async (tool: 'report' | 'defense' | 'cv') => {
    setLoadingAI(true);
    setAiResult(null);
    try {
      let result;
      if (tool === 'report') result = await generateReport(profile, logs);
      if (tool === 'defense') result = await prepareDefense(profile, logs);
      if (tool === 'cv') result = await generateCVPoints(logs);
      setAiResult({ type: tool, content: result });
    } catch (error) {
      console.error("AI Tool Error:", error);
    } finally {
      setLoadingAI(false);
    }
  };

  const exportPDF = async () => {
    const element = document.getElementById('ai-result-content');
    if (!element) return;
    
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Stajio_${aiResult.type}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const { copied, copy } = useClipboard();

  const copyToClipboard = async () => {
    if (!aiResult) return;
    const text = typeof aiResult.content === 'string' ? aiResult.content : JSON.stringify(aiResult.content, null, 2);
    await copy(text);
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
        fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:h-screen
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
            <button 
              onClick={() => { setActiveTab('journal'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'journal' ? 'bg-emerald-50 text-emerald-700 font-medium dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800'}`}
            >
              <BookOpen className="w-5 h-5" />
              Journal de bord
            </button>
            <button 
              onClick={() => { setActiveTab('deadlines'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'deadlines' ? 'bg-emerald-50 text-emerald-700 font-medium dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800'}`}
            >
              <Calendar className="w-5 h-5" />
              Deadlines
            </button>
            <button 
              onClick={() => { setActiveTab('tools'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'tools' ? 'bg-emerald-50 text-emerald-700 font-medium dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800'}`}
            >
              <Sparkles className="w-5 h-5" />
              Outils IA
            </button>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-stone-400 uppercase tracking-wider dark:text-stone-500">Aide & Plus</p>
            </div>
            <button 
              onClick={() => { setActiveTab('tutorial'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'tutorial' ? 'bg-emerald-50 text-emerald-700 font-medium dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800'}`}
            >
              <Info className="w-5 h-5" />
              Comment ça marche
            </button>
            <button 
              onClick={() => { setActiveTab('faq'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'faq' ? 'bg-emerald-50 text-emerald-700 font-medium dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800'}`}
            >
              <HelpCircle className="w-5 h-5" />
              FAQ
            </button>
            <button 
              onClick={() => { setActiveTab('profile'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'profile' ? 'bg-emerald-50 text-emerald-700 font-medium dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800'}`}
            >
              <UserCircle className="w-5 h-5" />
              Mon Profil
            </button>
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
          {activeTab === 'journal' && (
            <motion.div 
              key="journal"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-stone-900 dark:text-white">Journal de bord</h2>
                  <p className="text-stone-500 dark:text-stone-400">Documente tes progrès chaque semaine.</p>
                </div>
                <button 
                  onClick={() => setIsLogging(true)}
                  className="bg-emerald-600 dark:bg-emerald-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-all flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Nouvelle entrée
                </button>
              </div>

              {isLogging && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm mb-8"
                >
                  <textarea 
                    className="w-full h-32 p-4 rounded-xl border border-stone-100 dark:border-stone-800 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none mb-4"
                    placeholder="Qu'as-tu fait cette semaine ? (Missions, technos, problèmes...)"
                    value={newLog}
                    onChange={e => setNewLog(e.target.value)}
                  />
                  <div className="flex justify-end gap-3">
                    <button 
                      onClick={() => setIsLogging(false)}
                      className="px-6 py-2 rounded-xl text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"
                    >
                      Annuler
                    </button>
                    <button 
                      onClick={handleAddLog}
                      disabled={loadingAI || !newLog.trim()}
                      className="bg-stone-900 dark:bg-emerald-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-stone-800 dark:hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {loadingAI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      Enregistrer avec l'IA
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="space-y-6">
                {logs.map((log) => (
                  <div key={log.id} className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm relative group">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Semaine {log.weekNumber}</span>
                        <h3 className="text-xl font-bold text-stone-900 dark:text-white mt-1">{format(parseISO(log.date), 'dd MMMM yyyy', { locale: fr })}</h3>
                      </div>
                      <button 
                        onClick={() => deleteLog(log.id)}
                        className="text-stone-300 dark:text-stone-600 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <p className="text-stone-600 dark:text-stone-300 mb-6 leading-relaxed">{log.summary || log.structuredContent}</p>
                    
                    <div className="flex flex-wrap gap-2">
                      {log.technologies?.map((tech, i) => (
                        <span key={i} className="px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-lg text-xs font-medium">{tech}</span>
                      ))}
                      {log.skills?.map((skill, i) => (
                        <span key={i} className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-medium">{skill}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'deadlines' && (
            <motion.div 
              key="deadlines"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl"
            >
              <h2 className="text-3xl font-bold text-stone-900 dark:text-white mb-8">Deadlines</h2>
              
              <div className="bg-white dark:bg-stone-900 p-4 md:p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm mb-8">
                <div className="flex flex-col md:flex-row gap-4">
                  <input 
                    className="flex-1 p-3 rounded-xl border border-stone-100 dark:border-stone-800 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Titre de la deadline"
                    id="deadline-title"
                  />
                  <div className="flex gap-4">
                    <input 
                      type="date"
                      className="flex-1 p-3 rounded-xl border border-stone-100 dark:border-stone-800 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      id="deadline-date"
                    />
                    <select 
                      className="p-3 rounded-xl border border-stone-100 dark:border-stone-800 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      id="deadline-type"
                    >
                      <option value="school" className="dark:bg-stone-900">École</option>
                      <option value="company" className="dark:bg-stone-900">Entreprise</option>
                    </select>
                  </div>
                  <button 
                    onClick={async () => {
                      const titleInput = document.getElementById('deadline-title') as HTMLInputElement;
                      const dateInput = document.getElementById('deadline-date') as HTMLInputElement;
                      const typeInput = document.getElementById('deadline-type') as HTMLSelectElement;
                      const title = titleInput.value;
                      const date = dateInput.value;
                      const type = typeInput.value as 'school' | 'company';
                      if (title && date) {
                        await api.deadlines.add({ uid: user.uid, title, date, type, completed: false });
                        titleInput.value = "";
                        dateInput.value = "";
                        fetchData();
                      }
                    }}
                    className="bg-stone-900 dark:bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-stone-800 dark:hover:bg-emerald-700 transition-all"
                  >
                    Ajouter
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {deadlines.map((deadline) => (
                  <div 
                    key={deadline.id}
                    onClick={() => toggleDeadline(deadline.id, deadline.completed)}
                    className={`p-6 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${deadline.completed ? 'bg-stone-50 dark:bg-stone-800/50 border-stone-100 dark:border-stone-800 opacity-60' : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 shadow-sm hover:border-emerald-200 dark:hover:border-emerald-700'}`}
                  >
                    {deadline.completed ? <CheckCircle2 className="text-emerald-500 w-6 h-6" /> : <Circle className="text-stone-300 dark:text-stone-600 w-6 h-6" />}
                    <div className="flex-1">
                      <h4 className={`font-semibold ${deadline.completed ? 'text-stone-400 dark:text-stone-500 line-through' : 'text-stone-900 dark:text-white'}`}>{deadline.title}</h4>
                      <p className="text-sm text-stone-500 dark:text-stone-400">{format(parseISO(deadline.date), 'dd MMMM yyyy', { locale: fr })}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${deadline.type === 'school' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'}`}>
                      {deadline.type}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'tools' && (
            <motion.div 
              key="tools"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl"
            >
              <h2 className="text-3xl font-bold text-stone-900 dark:text-white mb-8">Outils IA</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                <button 
                  onClick={() => runAITool('report')}
                  className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm hover:border-emerald-500 dark:hover:border-emerald-500 transition-all text-left group"
                >
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-600 transition-colors">
                    <FileText className="text-emerald-600 dark:text-emerald-400 w-6 h-6 group-hover:text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">Rapport de stage</h3>
                  <p className="text-sm text-stone-500 dark:text-stone-400">Génère un brouillon complet basé sur ton journal.</p>
                </button>
                <button 
                  onClick={() => runAITool('defense')}
                  className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm hover:border-emerald-500 dark:hover:border-emerald-500 transition-all text-left group"
                >
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors">
                    <GraduationCap className="text-blue-600 dark:text-blue-400 w-6 h-6 group-hover:text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">Prépa Soutenance</h3>
                  <p className="text-sm text-stone-500 dark:text-stone-400">Plan de présentation et questions types du jury.</p>
                </button>
                <button 
                  onClick={() => runAITool('cv')}
                  className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm hover:border-emerald-500 dark:hover:border-emerald-500 transition-all text-left group"
                >
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-600 transition-colors">
                    <Briefcase className="text-purple-600 dark:text-purple-400 w-6 h-6 group-hover:text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">Expérience → CV</h3>
                  <p className="text-sm text-stone-500 dark:text-stone-400">Transforme tes missions en bullet points ATS.</p>
                </button>
              </div>

              {loadingAI && (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 animate-spin mb-4" />
                  <p className="text-stone-500 dark:text-stone-400 animate-pulse">L'IA réfléchit à ton parcours...</p>
                </div>
              )}

              {aiResult && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-stone-900 p-12 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                    <h3 className="text-2xl font-bold text-stone-900 dark:text-white">
                      {aiResult.type === 'report' && 'Ton Rapport de Stage'}
                      {aiResult.type === 'defense' && 'Ta Préparation de Soutenance'}
                      {aiResult.type === 'cv' && 'Tes Points CV'}
                    </h3>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={copyToClipboard}
                        className="flex items-center gap-2 text-stone-500 dark:text-stone-400 font-medium hover:text-stone-700 dark:hover:text-stone-300 text-sm"
                      >
                        <Copy className="w-4 h-4" />
                        {copied ? 'Copié !' : 'Copier'}
                      </button>
                      <button 
                        onClick={exportPDF}
                        className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium hover:text-emerald-700 dark:hover:text-emerald-300 text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Exporter PDF
                      </button>
                    </div>
                  </div>
                  
                  <div className="prose prose-stone dark:prose-invert max-w-none" id="ai-result-content">
                    {aiResult.type === 'defense' ? (
                      <div className="space-y-8">
                        <div>
                          <h4 className="text-lg font-bold mb-4">Plan de présentation</h4>
                          <ul className="space-y-2">
                            {aiResult.content.plan.map((item: string, i: number) => (
                              <li key={i} className="flex items-center gap-3">
                                <span className="w-6 h-6 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center text-xs font-bold text-stone-500 dark:text-stone-400">{i+1}</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-lg font-bold mb-4">Questions probables</h4>
                          <div className="space-y-4">
                            {aiResult.content.questions.map((q: any, i: number) => (
                              <div key={i} className="bg-stone-50 dark:bg-stone-800/50 p-6 rounded-2xl">
                                <p className="font-bold text-stone-900 dark:text-white mb-2">Q: {q.question}</p>
                                <p className="text-stone-600 dark:text-stone-400 text-sm italic">Conseil: {q.answerHint}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-stone dark:prose-invert max-w-none">
                        <Markdown>{aiResult.content}</Markdown>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
          {activeTab === 'tutorial' && <TutorialTab key="tutorial" />}
          {activeTab === 'faq' && <FAQTab key="faq" />}
          {activeTab === 'profile' && <ProfileTab profile={profile} user={user} onUpdate={onProfileUpdate} />}
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
    </ErrorBoundary>
  );
}
