import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { AiRequestError, proposeReportPlan } from "../../services/ai";
import type { Report, ReportSection } from "../../types/models";

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-transparent p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-stone-700 dark:text-white";

const newId = () => crypto.randomUUID();

export function PlanStep({
  report,
  onChange,
  beforeReplace,
}: {
  report: Report;
  onChange: (sections: ReportSection[]) => void;
  /** Saves the report and a version before the plan is replaced. */
  beforeReplace: (label: string) => Promise<void>;
}) {
  const { sections } = report;
  const [proposal, setProposal] = useState<Array<{ title: string; intent: string }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);

  const edit = (id: string, changes: Partial<ReportSection>) =>
    onChange(sections.map((section) => (section.id === id ? { ...section, ...changes } : section)));

  const move = (index: number, offset: number) => {
    const next = [...sections];
    const [item] = next.splice(index, 1);
    next.splice(index + offset, 0, item);
    onChange(next);
  };

  const remove = (section: ReportSection) => {
    if (
      section.content.trim() &&
      !window.confirm(
        `Supprimer « ${section.title} » et son contenu ? Une version reste récupérable si tu en as enregistré une.`,
      )
    )
      return;
    onChange(sections.filter((item) => item.id !== section.id));
  };

  const propose = async () => {
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setError("");
    try {
      await beforeReplace("");
      const { result } = await proposeReportPlan(report.id, current.signal);
      setProposal(result.sections);
    } catch (cause) {
      if (!(cause instanceof AiRequestError && cause.cancelled)) {
        setError(cause instanceof Error ? cause.message : "La proposition de plan a échoué.");
      }
    } finally {
      setLoading(false);
    }
  };

  /** Sections whose title is kept retain their text; nothing else is lost thanks to the version. */
  const applyProposal = async () => {
    if (!proposal) return;
    await beforeReplace("Avant nouveau plan");
    const byTitle = new Map(sections.map((section) => [section.title.trim().toLowerCase(), section]));
    onChange(
      proposal.map((item) => {
        const existing = byTitle.get(item.title.trim().toLowerCase());
        return existing
          ? { ...existing, title: item.title, intent: item.intent }
          : { id: newId(), title: item.title, intent: item.intent, content: "", generatedAt: null, model: null };
      }),
    );
    setProposal(null);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-600 dark:text-stone-300">
        Ajuste le plan avant de rédiger : titres, intention de chaque partie et ordre. Chaque section se rédige et se
        régénère séparément.
      </p>
      <ol className="space-y-3">
        {sections.map((section, index) => (
          <li key={section.id} className="rounded-2xl border border-stone-200 p-4 dark:border-stone-800">
            <div className="flex items-start gap-3">
              <span className="mt-3 w-6 shrink-0 text-center text-sm font-bold text-stone-400">{index + 1}</span>
              <div className="flex-1 space-y-2">
                <label htmlFor={`plan-title-${section.id}`} className="sr-only">
                  Titre de la section {index + 1}
                </label>
                <input
                  id={`plan-title-${section.id}`}
                  className={`${inputClass} font-semibold`}
                  value={section.title}
                  onChange={(event) => edit(section.id, { title: event.target.value })}
                />
                <label htmlFor={`plan-intent-${section.id}`} className="sr-only">
                  Intention de la section {index + 1}
                </label>
                <input
                  id={`plan-intent-${section.id}`}
                  className={inputClass}
                  placeholder="Ce que cette section doit démontrer"
                  value={section.intent}
                  onChange={(event) => edit(section.id, { intent: event.target.value })}
                />
                {section.content.trim() && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">Section déjà rédigée</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`Monter « ${section.title} »`}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 disabled:opacity-30 dark:hover:bg-stone-800"
                >
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={index === sections.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Descendre « ${section.title} »`}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 disabled:opacity-30 dark:hover:bg-stone-800"
                >
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => remove(section)}
                  aria-label={`Supprimer « ${section.title} »`}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-red-600 dark:hover:bg-stone-800"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            onChange([
              ...sections,
              { id: newId(), title: "Nouvelle section", intent: "", content: "", generatedAt: null, model: null },
            ])
          }
          className="flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          <Plus className="h-4 w-4" aria-hidden /> Ajouter une section
        </button>
        <button
          type="button"
          onClick={() => void propose()}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          Proposer un plan avec l'IA
        </button>
        {loading && (
          <button
            type="button"
            onClick={() => controller.current?.abort()}
            className="rounded-xl px-4 py-2 text-sm text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800"
          >
            Annuler
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error} Ton plan actuel n'a pas été modifié.
        </p>
      )}
      {proposal && (
        <section
          aria-labelledby="plan-proposal"
          className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-800 dark:bg-emerald-900/10"
        >
          <h3 id="plan-proposal" className="font-semibold text-stone-900 dark:text-white">
            Plan proposé par l'IA
          </h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-stone-700 dark:text-stone-300">
            {proposal.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                {item.intent && ` — ${item.intent}`}
              </li>
            ))}
          </ol>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Les sections au titre identique gardent leur texte. Une version du rapport est enregistrée avant le
            remplacement.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void applyProposal()}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
            >
              Remplacer mon plan
            </button>
            <button
              type="button"
              onClick={() => setProposal(null)}
              className="rounded-xl px-4 py-2 text-sm text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              Garder mon plan
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
