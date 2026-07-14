import { useMemo } from "react";
import { motion } from "motion/react";
import { format, differenceInCalendarWeeks, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { BookOpen, Calendar, Cpu, Flame, Sparkles, TrendingUp } from "lucide-react";
import type { Deadline, LogEntry, UserProfile } from "../../types/models";
import { getUrgency, sortDeadlines, TYPE_LABELS, URGENCY_STYLES } from "../../utils/deadlines";

type Props = {
  profile: UserProfile;
  logs: LogEntry[];
  deadlines: Deadline[];
  onNavigate: (tab: "journal" | "deadlines" | "tools") => void;
};

function countOccurrences(values: string[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function FrequencyBars({ items, accent }: { items: Array<{ name: string; count: number }>; accent: string }) {
  const max = items[0]?.count || 1;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-3">
          <span className="w-32 md:w-40 text-sm text-stone-600 dark:text-stone-300 truncate shrink-0" title={item.name}>
            {item.name}
          </span>
          <div className="flex-1 h-2.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${accent}`} style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 w-6 text-right shrink-0">
            {item.count}
          </span>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-sm text-stone-400 dark:text-stone-500">
          Ajoute des entrées de journal pour alimenter ces statistiques.
        </p>
      )}
    </div>
  );
}

export function DashboardTab({ profile, logs, deadlines, onNavigate }: Props) {
  const stats = useMemo(() => {
    const now = new Date();
    const start = parseISO(profile.internshipStart);
    const end = parseISO(profile.internshipEnd);
    const totalWeeks = Math.max(differenceInCalendarWeeks(end, start) + 1, 1);
    const currentWeek = Math.min(Math.max(differenceInCalendarWeeks(now, start) + 1, 0), totalWeeks);
    const progress = Math.min(Math.max((currentWeek / totalWeeks) * 100, 0), 100);

    const weeksWithEntries = new Set(logs.map((l) => l.weekNumber));
    let streak = 0;
    for (let week = currentWeek; week >= 1 && weeksWithEntries.has(week); week--) {
      streak += 1;
    }

    const technologies = countOccurrences(logs.flatMap((l) => l.technologies || []));
    const skills = countOccurrences(logs.flatMap((l) => l.skills || []));
    const pendingDeadlines = deadlines.filter((d) => !d.completed);
    const upcoming = sortDeadlines(pendingDeadlines).slice(0, 4);

    return { totalWeeks, currentWeek, progress, streak, technologies, skills, pendingDeadlines, upcoming };
  }, [profile, logs, deadlines]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-5xl"
    >
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-stone-900 dark:text-white">
          Salut, {profile.displayName.split(" ")[0]}
        </h2>
        <p className="text-stone-500 dark:text-stone-400">
          Voici où tu en es dans ton alternance chez {profile.company}.
        </p>
      </div>

      {/* Progression du stage */}
      <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 dark:text-white">Progression du stage</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Semaine {stats.currentWeek} sur {stats.totalWeeks}
              </p>
            </div>
          </div>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {Math.round(stats.progress)}%
          </span>
        </div>
        <div className="h-3 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stats.progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full bg-emerald-500 rounded-full"
          />
        </div>
        <p className="text-xs text-stone-400 dark:text-stone-500 mt-3">
          Du {format(parseISO(profile.internshipStart), "dd MMMM yyyy", { locale: fr })} au{" "}
          {format(parseISO(profile.internshipEnd), "dd MMMM yyyy", { locale: fr })}
        </p>
      </div>

      {/* Cartes de stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => onNavigate("journal")}
          className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm text-left hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
        >
          <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-3" />
          <p className="text-3xl font-bold text-stone-900 dark:text-white">{logs.length}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">Entrées de journal</p>
        </button>
        <button
          onClick={() => onNavigate("deadlines")}
          className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm text-left hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
        >
          <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-3" />
          <p className="text-3xl font-bold text-stone-900 dark:text-white">{stats.pendingDeadlines.length}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">Deadlines en cours</p>
        </button>
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
          <Cpu className="w-5 h-5 text-purple-600 dark:text-purple-400 mb-3" />
          <p className="text-3xl font-bold text-stone-900 dark:text-white">{stats.technologies.length}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">Technologies utilisées</p>
        </div>
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
          <Flame className="w-5 h-5 text-orange-500 mb-3" />
          <p className="text-3xl font-bold text-stone-900 dark:text-white">{stats.streak}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {stats.streak > 1 ? "Semaines d'affilée" : "Semaine d'affilée"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Prochaines deadlines */}
        <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-stone-900 dark:text-white">Prochaines deadlines</h3>
            <button
              onClick={() => onNavigate("deadlines")}
              className="text-sm text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
            >
              Tout voir
            </button>
          </div>
          <div className="space-y-3">
            {stats.upcoming.map((deadline) => {
              const urgency = getUrgency(deadline);
              return (
                <div key={deadline.id} className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${URGENCY_STYLES[urgency.tone]}`}>
                    {urgency.label}
                  </span>
                  <p className="text-sm text-stone-700 dark:text-stone-300 truncate flex-1">{deadline.title}</p>
                  <span className="text-xs text-stone-400 dark:text-stone-500 shrink-0">
                    {TYPE_LABELS[deadline.type]}
                  </span>
                </div>
              );
            })}
            {stats.upcoming.length === 0 && (
              <p className="text-sm text-stone-400 dark:text-stone-500">
                Aucune deadline en attente. Profites-en pour avancer sur ton rapport !
              </p>
            )}
          </div>
        </div>

        {/* Top technologies */}
        <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
          <h3 className="font-bold text-stone-900 dark:text-white mb-6">Technologies les plus utilisées</h3>
          <FrequencyBars items={stats.technologies.slice(0, 6)} accent="bg-purple-500" />
        </div>
      </div>

      {/* Matrice de compétences */}
      <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 dark:text-white">Matrice de compétences</h3>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Compétences extraites de ton journal, par fréquence. Idéal pour ton dossier de compétences.
            </p>
          </div>
        </div>
        <FrequencyBars items={stats.skills.slice(0, 10)} accent="bg-emerald-500" />
      </div>
    </motion.div>
  );
}
