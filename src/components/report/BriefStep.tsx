import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "../../services/api";
import type { LogEntry, Report, ReportBrief } from "../../types/models";
import { isCalendarDate } from "../../utils/internship";
import { missingBriefInformation } from "../../utils/report";

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-transparent p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-stone-700 dark:text-white";

type Estimate = { estimatedTokens: number; budgetTokens: number; fits: boolean } | null;

const inPeriod = (log: LogEntry, brief: ReportBrief) =>
  (!brief.periodStart || log.date >= brief.periodStart) && (!brief.periodEnd || log.date <= brief.periodEnd);

export function BriefStep({
  report,
  logs,
  onChange,
}: {
  report: Report;
  logs: LogEntry[];
  onChange: (brief: ReportBrief) => void;
}) {
  const { brief } = report;
  const [estimate, setEstimate] = useState<Estimate>(null);
  const [notice, setNotice] = useState("");
  const periodLogs = useMemo(
    () => logs.filter((log) => inPeriod(log, brief)).sort((a, b) => a.date.localeCompare(b.date)),
    [logs, brief],
  );
  const selected = new Set(brief.sourceLogIds);
  const knownIds = new Set(logs.map((log) => log.id));
  const staleIds = brief.sourceLogIds.filter((id) => !knownIds.has(id));
  const missing = missingBriefInformation(brief);
  const selectionKey = brief.sourceLogIds.join(",");

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      const logIds = brief.sourceLogIds.filter((id) => knownIds.has(id));
      api.ai
        .estimate({ task: "report", reportId: report.id, logIds })
        .then((result) => active && setEstimate(result))
        .catch(() => active && setEstimate(null));
    }, 800);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // knownIds is derived from logs; the selection key captures what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id, selectionKey, logs, brief.guidelines, brief.problem, brief.targetLength]);

  const set = (changes: Partial<ReportBrief>) => onChange({ ...brief, ...changes });

  const setPeriod = (changes: Pick<Partial<ReportBrief>, "periodStart" | "periodEnd">) => {
    const next = { ...brief, ...changes };
    const kept = next.sourceLogIds.filter((id) => {
      const log = logs.find((item) => item.id === id);
      return !log || inPeriod(log, next);
    });
    const removed = next.sourceLogIds.length - kept.length;
    setNotice(
      removed
        ? `${removed} note${removed > 1 ? "s" : ""} hors de la nouvelle période retirée${removed > 1 ? "s" : ""} de la sélection.`
        : "",
    );
    onChange({ ...next, sourceLogIds: kept });
  };

  const toggle = (id: string, checked: boolean) =>
    set({ sourceLogIds: checked ? [...brief.sourceLogIds, id] : brief.sourceLogIds.filter((item) => item !== id) });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <label htmlFor="brief-guidelines" className="text-xs font-semibold text-stone-500 dark:text-stone-400">
            Consignes de l'école (colle-les ici)
          </label>
          <textarea
            id="brief-guidelines"
            className={`${inputClass} h-36 resize-y`}
            value={brief.guidelines}
            onChange={(event) => set({ guidelines: event.target.value })}
            placeholder="Plan imposé, parties attendues, critères d'évaluation, format…"
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label htmlFor="brief-problem" className="text-xs font-semibold text-stone-500 dark:text-stone-400">
            Problématique
          </label>
          <input
            id="brief-problem"
            className={inputClass}
            value={brief.problem}
            onChange={(event) => set({ problem: event.target.value })}
            placeholder="Ex : Comment fiabiliser le déploiement d'une application métier ?"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="brief-length" className="text-xs font-semibold text-stone-500 dark:text-stone-400">
            Longueur indicative
          </label>
          <input
            id="brief-length"
            className={inputClass}
            value={brief.targetLength}
            onChange={(event) => set({ targetLength: event.target.value })}
            placeholder="Ex : 25 à 30 pages"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="brief-start" className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              Période : du
            </label>
            <input
              id="brief-start"
              type="date"
              className={inputClass}
              value={brief.periodStart}
              onChange={(event) => setPeriod({ periodStart: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="brief-end" className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              au
            </label>
            <input
              id="brief-end"
              type="date"
              className={inputClass}
              value={brief.periodEnd}
              onChange={(event) => setPeriod({ periodEnd: event.target.value })}
            />
          </div>
        </div>
      </div>

      <section aria-labelledby="brief-sources" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="brief-sources" className="font-semibold text-stone-900 dark:text-white">
            Notes sources ({brief.sourceLogIds.length - staleIds.length} sélectionnée
            {brief.sourceLogIds.length - staleIds.length > 1 ? "s" : ""})
          </h3>
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={() =>
                set({ sourceLogIds: [...new Set([...brief.sourceLogIds, ...periodLogs.map((log) => log.id)])] })
              }
              className="rounded-lg px-3 py-1 font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
            >
              Tout sélectionner
            </button>
            <button
              type="button"
              onClick={() => set({ sourceLogIds: [] })}
              className="rounded-lg px-3 py-1 font-medium text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              Aucune
            </button>
          </div>
        </div>
        {notice && <p className="text-sm text-amber-700 dark:text-amber-400">{notice}</p>}
        {staleIds.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            {staleIds.length} note{staleIds.length > 1 ? "s" : ""} sélectionnée{staleIds.length > 1 ? "s ont" : " a"}{" "}
            été supprimée{staleIds.length > 1 ? "s" : ""} du journal.
            <button
              type="button"
              className="font-medium underline"
              onClick={() => set({ sourceLogIds: brief.sourceLogIds.filter((id) => knownIds.has(id)) })}
            >
              Retirer de la sélection
            </button>
          </p>
        )}
        {periodLogs.length === 0 ? (
          <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500 dark:bg-stone-800/50 dark:text-stone-400">
            Aucune note du journal dans cette période.
          </p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto rounded-xl border border-stone-200 p-2 dark:border-stone-800">
            {periodLogs.map((log) => (
              <li key={log.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 text-sm hover:bg-stone-50 dark:hover:bg-stone-800/50">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-emerald-600"
                    checked={selected.has(log.id)}
                    onChange={(event) => toggle(log.id, event.target.checked)}
                  />
                  <span>
                    <span className="font-medium text-stone-800 dark:text-stone-200">
                      {isCalendarDate(log.date) ? format(parseISO(log.date), "dd MMM yyyy", { locale: fr }) : log.date}
                    </span>{" "}
                    <span className="text-stone-500 dark:text-stone-400">
                      — {(log.summary || log.rawContent).slice(0, 140)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {estimate && (
          <p
            className={`text-sm ${estimate.fits ? "text-stone-500 dark:text-stone-400" : "font-medium text-red-700 dark:text-red-400"}`}
            aria-live="polite"
          >
            Taille envoyée au modèle par section : environ {estimate.estimatedTokens} jetons sur {estimate.budgetTokens}{" "}
            disponibles.
            {!estimate.fits && " Sélection trop grande : réduis la période ou décoche des notes avant de générer."}
          </p>
        )}
      </section>

      <section
        aria-label="Informations à compléter"
        className={`rounded-2xl p-4 text-sm ${missing.length ? "bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200" : "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200"}`}
      >
        {missing.length ? (
          <>
            <p className="mb-1 flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" aria-hidden /> Avant de générer, il manque :
            </p>
            <ul className="list-disc space-y-0.5 pl-5">
              {missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs">
              Tu peux générer quand même : l'IA signalera les informations manquantes par « [À compléter : …] ».
            </p>
          </>
        ) : (
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Le brief est complet.
          </p>
        )}
      </section>
    </div>
  );
}
