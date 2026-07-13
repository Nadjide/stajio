import { useMemo } from "react";
import { motion } from "motion/react";
import { format, addWeeks, differenceInCalendarWeeks, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { BookOpen, CalendarClock, CheckCircle2 } from "lucide-react";
import type { Deadline, LogEntry, UserProfile } from "../../types/models";
import { TYPE_LABELS } from "../../utils/deadlines";

type Props = {
  profile: UserProfile;
  logs: LogEntry[];
  deadlines: Deadline[];
};

type WeekGroup = {
  weekNumber: number;
  startDate: Date;
  logs: LogEntry[];
  deadlines: Deadline[];
};

export function TimelineTab({ profile, logs, deadlines }: Props) {
  const weeks = useMemo(() => {
    const start = parseISO(profile.internshipStart);
    const groups = new Map<number, WeekGroup>();

    const getGroup = (weekNumber: number): WeekGroup => {
      let group = groups.get(weekNumber);
      if (!group) {
        group = {
          weekNumber,
          startDate: addWeeks(start, weekNumber - 1),
          logs: [],
          deadlines: [],
        };
        groups.set(weekNumber, group);
      }
      return group;
    };

    for (const log of logs) {
      getGroup(log.weekNumber || 1).logs.push(log);
    }
    for (const deadline of deadlines) {
      const week = differenceInCalendarWeeks(parseISO(deadline.date), start) + 1;
      if (week >= 1) getGroup(week).deadlines.push(deadline);
    }

    return [...groups.values()].sort((a, b) => b.weekNumber - a.weekNumber);
  }, [profile, logs, deadlines]);

  const currentWeek = differenceInCalendarWeeks(new Date(), parseISO(profile.internshipStart)) + 1;

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
        <div className="bg-white dark:bg-stone-900 p-12 rounded-3xl border border-dashed border-stone-300 dark:border-stone-700 text-center">
          <p className="text-stone-500 dark:text-stone-400">
            La timeline se remplira au fil de tes entrées de journal et de tes deadlines.
          </p>
        </div>
      )}

      <div className="relative pl-8 space-y-8">
        {/* Ligne verticale */}
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-stone-200 dark:bg-stone-800" />

        {weeks.map((week) => (
          <div key={week.weekNumber} className="relative">
            <div
              className={`absolute -left-8 top-1 w-6 h-6 rounded-full border-4 border-stone-50 dark:border-stone-950 ${
                week.weekNumber === currentWeek ? "bg-emerald-500" : "bg-stone-300 dark:bg-stone-700"
              }`}
            />
            <div className="mb-3">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Semaine {week.weekNumber}
                {week.weekNumber === currentWeek && " · En cours"}
              </span>
              <p className="text-sm text-stone-400 dark:text-stone-500">
                À partir du {format(week.startDate, "dd MMMM yyyy", { locale: fr })}
              </p>
            </div>

            <div className="space-y-3">
              {week.deadlines.map((deadline) => (
                <div
                  key={deadline.id}
                  className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-3"
                >
                  {deadline.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : (
                    <CalendarClock className="w-5 h-5 text-orange-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold truncate ${
                        deadline.completed
                          ? "text-stone-400 dark:text-stone-500 line-through"
                          : "text-stone-900 dark:text-white"
                      }`}
                    >
                      {deadline.title}
                    </p>
                    <p className="text-xs text-stone-400 dark:text-stone-500">
                      {format(parseISO(deadline.date), "dd MMM", { locale: fr })} · {TYPE_LABELS[deadline.type]}
                    </p>
                  </div>
                </div>
              ))}

              {week.logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <p className="text-xs text-stone-400 dark:text-stone-500">
                      {format(parseISO(log.date), "dd MMMM yyyy", { locale: fr })}
                    </p>
                  </div>
                  <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed line-clamp-3">
                    {log.summary || log.structuredContent}
                  </p>
                  {(log.technologies?.length || 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {log.technologies?.slice(0, 6).map((tech, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 rounded-md text-[11px] font-medium"
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
