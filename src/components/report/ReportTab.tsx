import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, FileText, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api } from "../../services/api";
import { useToast } from "../ui/Toast";
import type { LogEntry, Report, ReportProvenance, ReportSection, UserProfile } from "../../types/models";
import { BriefStep } from "./BriefStep";
import { PlanStep } from "./PlanStep";
import { ReviewStep } from "./ReviewStep";
import { SAVE_STATUS_LABELS, useReportAutosave, waitForReportSave } from "./useReportAutosave";
import { WriteStep } from "./WriteStep";

type Step = "brief" | "plan" | "write" | "review";
const STEPS: Array<{ id: Step; label: string }> = [
  { id: "brief", label: "1. Brief" },
  { id: "plan", label: "2. Plan" },
  { id: "write", label: "3. Rédaction" },
  { id: "review", label: "4. Relecture et export" },
];

function ReportWorkspace({
  initial,
  profile,
  logs,
  onDeleted,
}: {
  initial: Report;
  profile: UserProfile;
  logs: LogEntry[];
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const { report, status, conflict, update, replace, overwrite, flush } = useReportAutosave(initial);
  const [step, setStep] = useState<Step>(
    initial.sections.some((section) => section.content.trim()) ? "write" : "brief",
  );

  const saveVersion = async (label: string) => {
    await flush();
    if (label) await api.reports.saveVersion(report.id, label);
  };

  const applyGeneration = async (
    section: ReportSection,
    content: string,
    provenance: ReportProvenance | null,
    replaceContent: boolean,
  ) => {
    try {
      if (replaceContent && section.content.trim())
        await saveVersion(`Avant régénération de « ${section.title} »`.slice(0, 200));
    } catch (cause) {
      toast(
        cause instanceof Error
          ? cause.message
          : "La version de sauvegarde n'a pas pu être créée ; rien n'a été remplacé.",
        "error",
      );
      return;
    }
    update((current) => ({
      ...current,
      provenance: provenance ?? current.provenance,
      sections: current.sections.map((item) =>
        item.id === section.id
          ? {
              ...item,
              content: replaceContent || !item.content.trim() ? content : `${item.content.trimEnd()}\n\n${content}`,
              generatedAt: provenance?.generatedAt ?? new Date().toISOString(),
              model: provenance?.model ?? item.model,
            }
          : item,
      ),
    }));
  };

  const remove = async () => {
    if (!window.confirm(`Supprimer définitivement « ${report.title} » et toutes ses versions ?`)) return;
    try {
      await api.reports.delete(report.id);
      onDeleted();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "La suppression a échoué.", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="report-title" className="sr-only">
          Titre du rapport
        </label>
        <input
          id="report-title"
          className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent p-1 text-2xl font-bold text-stone-900 outline-none hover:border-stone-200 focus:border-stone-200 focus:ring-2 focus:ring-emerald-500 dark:text-white dark:hover:border-stone-700"
          value={report.title}
          onChange={(event) => update((current) => ({ ...current, title: event.target.value || "Rapport" }))}
        />
        <span
          className={`text-xs ${status === "error" || status === "conflict" ? "font-semibold text-red-600" : "text-stone-400 dark:text-stone-500"}`}
          aria-live="polite"
        >
          {SAVE_STATUS_LABELS[status]}
        </span>
        <button
          type="button"
          onClick={() => void remove()}
          aria-label="Supprimer ce rapport"
          className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-red-600 dark:hover:bg-stone-800"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {status === "conflict" && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
          <p className="flex-1">
            Ce rapport a été modifié dans un autre onglet. Tes modifications ici ne sont pas encore enregistrées.
          </p>
          {conflict && (
            <button
              type="button"
              onClick={() => replace(conflict)}
              className="rounded-lg border border-red-300 px-3 py-1.5 font-medium"
            >
              Charger la version enregistrée
            </button>
          )}
          <button
            type="button"
            onClick={() => void overwrite()}
            className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white"
          >
            Garder ma version
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Étapes du rapport">
        {STEPS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={step === item.id}
            onClick={() => setStep(item.id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${step === item.id ? "bg-emerald-600 text-white" : "bg-white text-stone-600 hover:bg-stone-100 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8 dark:border-stone-800 dark:bg-stone-900"
        role="tabpanel"
      >
        {step === "brief" && (
          <BriefStep report={report} logs={logs} onChange={(brief) => update((current) => ({ ...current, brief }))} />
        )}
        {step === "plan" && (
          <PlanStep
            report={report}
            onChange={(sections) => update((current) => ({ ...current, sections }))}
            beforeReplace={saveVersion}
          />
        )}
        {step === "write" && (
          <WriteStep
            report={report}
            onSectionChange={(id, changes) =>
              update((current) => ({
                ...current,
                sections: current.sections.map((section) => (section.id === id ? { ...section, ...changes } : section)),
              }))
            }
            onApplyGeneration={applyGeneration}
          />
        )}
        {step === "review" && (
          <ReviewStep
            report={report}
            profile={profile}
            flush={() => flush()}
            onValidate={(validated) => update((current) => ({ ...current, status: validated ? "validated" : "draft" }))}
            onRestored={replace}
          />
        )}
      </div>
    </div>
  );
}

/** Always edits the stored revision, after any save still running from a previous visit. */
function ReportLoader({
  id,
  profile,
  logs,
  onDeleted,
}: {
  id: string;
  profile: UserProfile;
  logs: LogEntry[];
  onDeleted: () => void;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      await waitForReportSave(id);
      setReport(await api.reports.get(id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d'ouvrir ce rapport.");
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
      >
        <p className="flex-1">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white"
        >
          <RefreshCw className="h-4 w-4" aria-hidden /> Réessayer
        </button>
      </div>
    );
  }
  if (!report) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-stone-500" role="status">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> Ouverture du rapport…
      </div>
    );
  }
  return <ReportWorkspace initial={report} profile={profile} logs={logs} onDeleted={onDeleted} />;
}

export function ReportTab({ profile, logs }: { profile: UserProfile; logs: LogEntry[] }) {
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const list = await api.reports.list();
      setReports(list);
      setSelectedId((current) =>
        current && list.some((report) => report.id === current) ? current : (list[0]?.id ?? null),
      );
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setCreating(true);
    try {
      const report = await api.reports.create(reports?.length ? `Rapport ${reports.length + 1}` : "Rapport de stage");
      setReports((current) => [report, ...(current ?? [])]);
      setSelectedId(report.id);
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "Le rapport n'a pas pu être créé.", "error");
    } finally {
      setCreating(false);
    }
  };

  const selected = reports?.find((report) => report.id === selectedId) ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-5xl"
    >
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900 dark:text-white">Rapport</h2>
          <p className="text-stone-500 dark:text-stone-400">
            Prépare le brief, valide un plan, rédige section par section et exporte la version relue.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {reports && reports.length > 1 && (
            <>
              <label htmlFor="report-select" className="sr-only">
                Choisir un rapport
              </label>
              <select
                id="report-select"
                className="rounded-xl border border-stone-200 bg-white p-2.5 text-sm dark:border-stone-700 dark:bg-stone-900 dark:text-white"
                value={selectedId ?? ""}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {reports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {report.title}
                  </option>
                ))}
              </select>
            </>
          )}
          {reports && reports.length > 0 && (
            <button
              type="button"
              onClick={() => void create()}
              disabled={creating}
              className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
            >
              <Plus className="h-4 w-4" aria-hidden /> Nouveau rapport
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
        >
          <p className="flex-1">Impossible de charger tes rapports. Ils ne sont pas perdus.</p>
          <button
            type="button"
            onClick={() => void load()}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white"
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> Réessayer
          </button>
        </div>
      )}
      {!error && reports === null && (
        <div className="flex items-center justify-center gap-3 py-16 text-stone-500" role="status">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> Chargement…
        </div>
      )}
      {reports?.length === 0 && (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center dark:border-stone-700 dark:bg-stone-900">
          <FileText className="mx-auto mb-4 h-10 w-10 text-emerald-500" aria-hidden />
          <p className="mb-6 text-stone-500 dark:text-stone-400">
            Commence par renseigner les consignes de ton école et choisir les notes à utiliser. Tu gardes la main sur
            chaque section.
          </p>
          <button
            type="button"
            onClick={() => void create()}
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-medium text-white disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-5 w-5" aria-hidden />
            )}{" "}
            Créer mon rapport
          </button>
        </div>
      )}
      {selected && (
        <ReportLoader
          key={selected.id}
          id={selected.id}
          profile={profile}
          logs={logs}
          onDeleted={() => {
            setSelectedId(null);
            void load();
          }}
        />
      )}
    </motion.div>
  );
}
