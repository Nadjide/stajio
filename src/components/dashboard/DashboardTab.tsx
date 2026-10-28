import { useMemo } from "react";
import { motion } from "motion/react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  CalendarPlus,
  Flame,
  Loader2,
  PenLine,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { api } from "../../services/api";
import type { Deadline, LogEntry, Skill, UserProfile } from "../../types/models";
import { getUrgency, sortDeadlines, TYPE_LABELS, URGENCY_STYLES } from "../../utils/deadlines";
import {
  formatLocalDate,
  getInternshipProgress,
  getInternshipWeek,
  getInternshipWeekLabel,
  getPeriodPosition,
  isCalendarDate,
} from "../../utils/internship";
import { SKILL_LEVEL_LABELS, SKILL_LEVEL_STYLES } from "../../utils/skills";
import type { DataStatus } from "../journal/JournalTab";

type Props = {
  profile: UserProfile;
  logs: LogEntry[];
  deadlines: Deadline[];
  skills: Skill[];
  status: DataStatus;
  onRetry: () => Promise<void>;
  onNavigate: (tab: "journal" | "deadlines" | "skills") => void;
};

function countOccurrences(values: string[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export function DashboardTab({ profile, logs, deadlines, skills, status, onRetry, onNavigate }: Props) {
  const stats = useMemo(() => {
    const today = formatLocalDate();
    const { totalWeeks, currentWeek, progress } = getInternshipProgress(profile.internshipStart, profile.internshipEnd);
    const weeksWithEntries = new Set(logs.map((log) => getInternshipWeek(log.date, profile.internshipStart)));
    let streak = 0;
    for (let week = currentWeek; week >= 1 && weeksWithEntries.has(week); week--) {
      streak += 1;
    }
    const pendingDeadlines = sortDeadlines(deadlines.filter((d) => !d.completed));
    const now = new Date();
    const overdue = pendingDeadlines.filter((d) => differenceInCalendarDays(parseISO(d.date), now) < 0);
    const soon = pendingDeadlines.filter((d) => {
      const days = differenceInCalendarDays(parseISO(d.date), now);
      return days >= 0 && days <= 7;
    });
    const inProgress = getPeriodPosition(today, profile.internshipStart, profile.internshipEnd) === "during";
    const needsJournal = inProgress && currentWeek > 0 && !weeksWithEntries.has(currentWeek);
    const technologies = countOccurrences(logs.flatMap((l) => l.technologies || []));
    const provenSkills = skills.filter((skill) => skill.logIds.length > 0).length;
    return {
      totalWeeks,
      currentWeek,
      progress,
      streak,
      pendingDeadlines,
      upcoming: pendingDeadlines.slice(0, 5),
      overdue,
      soon,
      needsJournal,
      technologies,
      provenSkills,
    };
  }, [profile, logs, deadlines, skills]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-stone-500 dark:text-stone-400" role="status">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> Chargement de tes données…
      </div>
    );
  }

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
        <p className="text-stone-500 dark:text-stone-400">Voici où tu en es dans ton stage chez {profile.company}.</p>
      </div>

      {status === "error" && (
        <div
          role="alert"
          className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
        >
          <p className="flex-1">Impossible de charger tes notes et échéances. Elles ne sont pas perdues.</p>
          <button
            type="button"
            onClick={() => void onRetry()}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white"
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> Réessayer
          </button>
        </div>
      )}

      {(stats.overdue.length > 0 || stats.soon.length > 0 || stats.needsJournal) && (
        <section aria-label="À traiter" className="mb-6 space-y-3">
          {stats.overdue.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
              <p className="flex-1">
                <strong>
                  {stats.overdue.length} échéance{stats.overdue.length > 1 ? "s" : ""} en retard
                </strong>{" "}
                : {stats.overdue.map((d) => d.title).join(", ")}
              </p>
              <button type="button" onClick={() => onNavigate("deadlines")} className="font-medium underline">
                Voir
              </button>
            </div>
          )}
          {stats.soon.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              <Calendar className="h-5 w-5 shrink-0" aria-hidden />
              <p className="flex-1">
                <strong>Dans les 7 prochains jours</strong> :{" "}
                {stats.soon.map((d) => `${d.title} (${getUrgency(d).label.toLowerCase()})`).join(", ")}
              </p>
            </div>
          )}
          {stats.needsJournal && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
              <PenLine className="h-5 w-5 shrink-0" aria-hidden />
              <p className="flex-1">
                Tu n'as encore rien noté cette semaine. Quelques lignes suffisent pour garder une trace.
              </p>
              <button
                type="button"
                onClick={() => onNavigate("journal")}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white"
              >
                Écrire une note
              </button>
            </div>
          )}
        </section>
      )}

      <div className="mb-6 rounded-3xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 dark:text-white">Avancement dans la période</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {stats.totalWeeks
                  ? `${getInternshipWeekLabel(stats.currentWeek)}${stats.currentWeek ? ` sur ${stats.totalWeeks}` : ""}`
                  : "Dates du stage à vérifier"}
              </p>
            </div>
          </div>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {Math.round(stats.progress)}%
          </span>
        </div>
        <div
          className="h-3 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(stats.progress)}
          aria-label="Temps écoulé dans la période"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stats.progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full bg-emerald-500"
          />
        </div>
        <p className="mt-3 text-xs text-stone-400 dark:text-stone-500">
          {isCalendarDate(profile.internshipStart) && isCalendarDate(profile.internshipEnd)
            ? `Du ${format(parseISO(profile.internshipStart), "dd MMMM yyyy", { locale: fr })} au ${format(parseISO(profile.internshipEnd), "dd MMMM yyyy", { locale: fr })}`
            : "Vérifie les dates dans ton profil."}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => onNavigate("journal")}
          className="rounded-2xl border border-stone-200 bg-white p-6 text-left shadow-sm transition-all hover:border-emerald-300 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-emerald-700"
        >
          <BookOpen className="mb-3 h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p className="text-3xl font-bold text-stone-900 dark:text-white">{logs.length}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">Notes du journal</p>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("deadlines")}
          className="rounded-2xl border border-stone-200 bg-white p-6 text-left shadow-sm transition-all hover:border-emerald-300 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-emerald-700"
        >
          <Calendar className="mb-3 h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden />
          <p className="text-3xl font-bold text-stone-900 dark:text-white">{stats.pendingDeadlines.length}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">Échéances à venir</p>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("skills")}
          className="rounded-2xl border border-stone-200 bg-white p-6 text-left shadow-sm transition-all hover:border-emerald-300 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-emerald-700"
        >
          <Award className="mb-3 h-5 w-5 text-purple-600 dark:text-purple-400" aria-hidden />
          <p className="text-3xl font-bold text-stone-900 dark:text-white">
            {stats.provenSkills}
            <span className="text-lg text-stone-400">/{skills.length}</span>
          </p>
          <p className="text-sm text-stone-500 dark:text-stone-400">Compétences avec preuve</p>
        </button>
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <Flame className="mb-3 h-5 w-5 text-orange-500" aria-hidden />
          <p className="text-3xl font-bold text-stone-900 dark:text-white">{stats.streak}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {stats.streak > 1 ? "Semaines notées d'affilée" : "Semaine notée d'affilée"}
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-stone-900 dark:text-white">Prochaines échéances</h3>
            <div className="flex items-center gap-3">
              <a
                href={api.deadlines.calendarUrl}
                download
                className="flex items-center gap-1 text-sm font-medium text-stone-500 hover:underline dark:text-stone-400"
              >
                <CalendarPlus className="h-4 w-4" aria-hidden /> Calendrier (.ics)
              </a>
              <button
                type="button"
                onClick={() => onNavigate("deadlines")}
                className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
              >
                Tout voir
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {stats.upcoming.map((deadline) => {
              const urgency = getUrgency(deadline);
              return (
                <div key={deadline.id} className="flex items-center gap-3">
                  <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold ${URGENCY_STYLES[urgency.tone]}`}>
                    {urgency.label}
                  </span>
                  <p className="flex-1 truncate text-sm text-stone-700 dark:text-stone-300">{deadline.title}</p>
                  <span className="shrink-0 text-xs text-stone-400 dark:text-stone-500">
                    {TYPE_LABELS[deadline.type]}
                  </span>
                </div>
              );
            })}
            {stats.upcoming.length === 0 && (
              <p className="text-sm text-stone-400 dark:text-stone-500">Aucune échéance en attente.</p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <h3 className="mb-1 font-bold text-stone-900 dark:text-white">Technologies citées</h3>
          <p className="mb-6 text-xs text-stone-400 dark:text-stone-500">Nombre de notes qui les mentionnent.</p>
          <ul className="space-y-2">
            {stats.technologies.slice(0, 8).map((item) => (
              <li
                key={item.name}
                className="flex items-center justify-between text-sm text-stone-600 dark:text-stone-300"
              >
                <span className="truncate">{item.name}</span>
                <span className="shrink-0 text-xs font-semibold text-stone-400">{item.count}</span>
              </li>
            ))}
            {stats.technologies.length === 0 && (
              <li className="text-sm text-stone-400 dark:text-stone-500">
                Structure tes notes pour faire apparaître les outils utilisés.
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <Award className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 dark:text-white">Mes compétences</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Niveaux déclarés par toi, appuyés sur des notes du journal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("skills")}
            className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Gérer
          </button>
        </div>
        {skills.length === 0 ? (
          <p className="text-sm text-stone-400 dark:text-stone-500">
            Aucune compétence pour l'instant. Ajoute celles que tu veux démontrer et relie-les à tes notes.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {skills.slice(0, 8).map((skill) => (
              <li key={skill.id} className="rounded-2xl bg-stone-50 p-4 dark:bg-stone-800/50">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium text-stone-900 dark:text-white">{skill.label}</p>
                  <span
                    className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-semibold ${SKILL_LEVEL_STYLES[skill.level]}`}
                  >
                    {SKILL_LEVEL_LABELS[skill.level]} (déclaré)
                  </span>
                </div>
                {skill.goal && (
                  <p className="mt-1 line-clamp-2 text-xs text-stone-500 dark:text-stone-400">
                    Objectif : {skill.goal}
                  </p>
                )}
                <p
                  className={`mt-2 text-xs font-medium ${skill.logIds.length ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}
                >
                  {skill.logIds.length
                    ? `${skill.logIds.length} note${skill.logIds.length > 1 ? "s" : ""} en preuve`
                    : "Aucune preuve pour l'instant"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
