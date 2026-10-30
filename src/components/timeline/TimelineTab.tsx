import { useMemo } from "react";
import { motion } from "motion/react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { BookOpen, CalendarClock, CheckCircle2 } from "lucide-react";
import type { Deadline, LogEntry, Skill, UserProfile } from "../../types/models";
import { TYPE_LABELS } from "../../utils/deadlines";
import {
  formatLocalDate,
  getInternshipProgress,
  getInternshipWeek,
  getInternshipWeekLabel,
  getInternshipWeekStart,
  isCalendarDate,
} from "../../utils/internship";

type Props = {
  profile: UserProfile;
  logs: LogEntry[];
  deadlines: Deadline[];
  skills: Skill[];
};

type WeekGroup = {
  weekNumber: number;
  startDate: string;
  logs: LogEntry[];
  deadlines: Deadline[];
};

/** Notes and deadlines share the journal's week rule, so both land in the same week. */
export function TimelineTab({ profile, logs, deadlines, skills }: Props) {
  const { totalWeeks } = getInternshipProgress(profile.internshipStart, profile.internshipEnd);
  const weeks = useMemo(() => {
    const groups = new Map<number, WeekGroup>();

    const getGroup = (weekNumber: number): WeekGroup => {
      let group = groups.get(weekNumber);
      if (!group) {
        group = {
          weekNumber,
          startDate: weekNumber ? getInternshipWeekStart(profile.internshipStart, weekNumber) : profile.internshipStart,
          logs: [],
          deadlines: [],
        };
        groups.set(weekNumber, group);
      }
      return group;
    };

    for (const log of logs) {
      getGroup(getInternshipWeek(log.date, profile.internshipStart)).logs.push(log);
    }
    for (const deadline of deadlines) {
      getGroup(getInternshipWeek(deadline.date, profile.internshipStart)).deadlines.push(deadline);
    }

    for (const group of groups.values()) {
      group.logs.sort((a, b) => b.date.localeCompare(a.date));
      group.deadlines.sort((a, b) => a.date.localeCompare(b.date));
    }
    return [...groups.values()].sort((a, b) => b.weekNumber - a.weekNumber);
  }, [profile, logs, deadlines]);

  const currentWeek = getInternshipWeek(formatLocalDate(), profile.internshipStart);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-3xl"
    >
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-stone-900 dark:text-white">Timeline du stage</h2>
        <p className="text-stone-500 dark:text-stone-400">
          Ton parcours semaine par semaine — parfait pour préparer la soutenance.
        </p>
      </div>

      {weeks.length === 0 && (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center dark:border-stone-700 dark:bg-stone-900">
          <p className="text-stone-500 dark:text-stone-400">
            La timeline se remplira au fil de tes notes de journal et de tes échéances.
          </p>
        </div>
      )}

      <div className="relative space-y-8 pl-8">
        {/* Ligne verticale */}
        <div className="absolute top-2 bottom-2 left-[11px] w-0.5 bg-stone-200 dark:bg-stone-800" />

        {weeks.map((week) => (
          <div key={week.weekNumber} className="relative">
            <div
              className={`absolute top-1 -left-8 h-6 w-6 rounded-full border-4 border-stone-50 dark:border-stone-950 ${
                week.weekNumber === currentWeek ? "bg-emerald-500" : "bg-stone-300 dark:bg-stone-700"
              }`}
            />
            <div className="mb-3">
              <span className="text-xs font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                {getInternshipWeekLabel(week.weekNumber, totalWeeks)}
                {week.weekNumber === currentWeek && " · En cours"}
              </span>
              <p className="text-sm text-stone-400 dark:text-stone-500">
                {isCalendarDate(week.startDate)
                  ? `${week.weekNumber ? "À partir du" : "Avant le"} ${format(parseISO(week.startDate), "dd MMMM yyyy", { locale: fr })}`
                  : "Date de début à vérifier"}
              </p>
            </div>

            <div className="space-y-3">
              {week.deadlines.map((deadline) => (
                <div
                  key={deadline.id}
                  className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900"
                >
                  {deadline.completed ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                  ) : (
                    <CalendarClock className="h-5 w-5 shrink-0 text-orange-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-semibold ${
                        deadline.completed
                          ? "text-stone-400 line-through dark:text-stone-500"
                          : "text-stone-900 dark:text-white"
                      }`}
                    >
                      {deadline.title}
                    </p>
                    <p className="text-xs text-stone-400 dark:text-stone-500">
                      {isCalendarDate(deadline.date)
                        ? format(parseISO(deadline.date), "dd MMM", { locale: fr })
                        : "Date à vérifier"}{" "}
                      · {TYPE_LABELS[deadline.type]}
                    </p>
                  </div>
                </div>
              ))}

              {week.logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs text-stone-400 dark:text-stone-500">
                      {isCalendarDate(log.date)
                        ? format(parseISO(log.date), "dd MMMM yyyy", { locale: fr })
                        : "Date à vérifier"}
                    </p>
                  </div>
                  <p className="line-clamp-3 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                    {log.summary || log.structuredContent || log.rawContent}
                  </p>
                  {skills.some((skill) => skill.logIds.includes(log.id)) && (
                    <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Preuve de :{" "}
                      {skills
                        .filter((skill) => skill.logIds.includes(log.id))
                        .map((skill) => skill.label)
                        .join(", ")}
                    </p>
                  )}
                  {(log.technologies?.length || 0) > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {log.technologies?.slice(0, 6).map((tech, i) => (
                        <span
                          key={i}
                          className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
