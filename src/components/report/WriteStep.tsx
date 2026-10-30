import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Eye, Loader2, PenLine, RefreshCw, Sparkles, Square } from "lucide-react";
import { AiRequestError, generateReportSection, type GenerationMeta } from "../../services/ai";
import type { Report, ReportProvenance, ReportSection } from "../../types/models";
import { countToComplete } from "../../utils/ai-budget";
import { wordCount } from "../../utils/report";
import { MarkdownPreview } from "./MarkdownPreview";

type Proposal = { text: string; meta: GenerationMeta | null; complete: boolean; error?: string };

function instructionsSnapshot(report: Report, meta: GenerationMeta) {
  const { brief } = report;
  return [
    `Consignes : ${brief.guidelines.trim() || "aucune"}`,
    `Problématique : ${brief.problem.trim() || "non définie"}`,
    `Longueur : ${brief.targetLength.trim() || "non précisée"}`,
    `Période : ${brief.periodStart || "?"} → ${brief.periodEnd || "?"}`,
    `Consignes IA : ${meta.instructions || "inconnues"}`,
  ].join("\n");
}

function SectionEditor({
  report,
  section,
  onChange,
  onApplyGeneration,
}: {
  report: Report;
  section: ReportSection;
  onChange: (changes: Partial<ReportSection>) => void;
  onApplyGeneration: (
    section: ReportSection,
    content: string,
    provenance: ReportProvenance | null,
    replace: boolean,
  ) => Promise<void>;
}) {
  const [view, setView] = useState<"write" | "preview">("write");
  const [generating, setGenerating] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [applying, setApplying] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const markers = countToComplete(section.content);

  useEffect(() => () => controller.current?.abort(), []);

  const generate = async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setGenerating(true);
    setProposal({ text: "", meta: null, complete: false });
    try {
      const result = await generateReportSection(report.id, section.id, {
        signal: current.signal,
        onText: (text) => setProposal((previous) => ({ ...(previous ?? { meta: null, complete: false }), text })),
        onMeta: (meta) => setProposal((previous) => ({ ...(previous ?? { text: "", complete: false }), meta })),
      });
      setProposal({ text: result.text, meta: result.meta, complete: true });
    } catch (cause) {
      const partial = cause instanceof AiRequestError ? cause.partial : "";
      const message = cause instanceof Error ? cause.message : "La génération a échoué.";
      setProposal((previous) => ({ text: partial, meta: previous?.meta ?? null, complete: false, error: message }));
    } finally {
      setGenerating(false);
    }
  };

  const apply = async (replace: boolean) => {
    if (!proposal?.text.trim()) return;
    setApplying(true);
    try {
      const meta = proposal.meta;
      const provenance: ReportProvenance | null = meta?.sources
        ? {
            model: meta.model,
            generatedAt: meta.generatedAt || new Date().toISOString(),
            instructions: instructionsSnapshot(report, meta),
            sources: meta.sources,
          }
        : null;
      const text = proposal.complete
        ? proposal.text.trim()
        : `${proposal.text.trim()}\n\n[À compléter : la génération a été interrompue ici]`;
      await onApplyGeneration(section, text, provenance, replace);
      setProposal(null);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`section-title-${section.id}`} className="sr-only">
          Titre de la section
        </label>
        <input
          id={`section-title-${section.id}`}
          className="w-full rounded-xl border border-transparent bg-transparent p-1 text-xl font-bold text-stone-900 outline-none hover:border-stone-200 focus:border-stone-200 focus:ring-2 focus:ring-emerald-500 dark:text-white dark:hover:border-stone-700"
          value={section.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
        {section.intent && <p className="px-1 text-sm text-stone-500 dark:text-stone-400">{section.intent}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-stone-100 p-1 dark:bg-stone-800" role="group" aria-label="Mode d'affichage">
          <button
            type="button"
            aria-pressed={view === "write"}
            onClick={() => setView("write")}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium ${view === "write" ? "bg-white shadow-sm dark:bg-stone-900 dark:text-white" : "text-stone-500"}`}
          >
            <PenLine className="h-4 w-4" aria-hidden /> Écrire
          </button>
          <button
            type="button"
            aria-pressed={view === "preview"}
            onClick={() => setView("preview")}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium ${view === "preview" ? "bg-white shadow-sm dark:bg-stone-900 dark:text-white" : "text-stone-500"}`}
          >
            <Eye className="h-4 w-4" aria-hidden /> Aperçu
          </button>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          {section.content.trim() ? "Proposer une nouvelle version" : "Rédiger avec l'IA"}
        </button>
        {generating && (
          <button
            type="button"
            onClick={() => controller.current?.abort()}
            className="flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-sm dark:border-stone-700 dark:text-stone-300"
          >
            <Square className="h-3.5 w-3.5" aria-hidden /> Arrêter
          </button>
        )}
        <span className="ml-auto text-xs text-stone-400 dark:text-stone-500">
          {wordCount(section.content)} mots{markers ? ` · ${markers} passage${markers > 1 ? "s" : ""} à compléter` : ""}
        </span>
      </div>

      {view === "write" ? (
        <>
          <label htmlFor={`section-content-${section.id}`} className="sr-only">
            Contenu de la section en Markdown
          </label>
          <textarea
            id={`section-content-${section.id}`}
            className="h-96 w-full resize-y rounded-2xl border border-stone-200 bg-transparent p-4 font-mono text-sm leading-relaxed outline-none focus:ring-2 focus:ring-emerald-500 dark:border-stone-700 dark:text-stone-100"
            value={section.content}
            placeholder="Rédige en Markdown : ### sous-titre, - liste, **gras**. Les passages « [À compléter : …] » sont surlignés dans l'aperçu."
            onChange={(event) => onChange({ content: event.target.value })}
          />
        </>
      ) : (
        <div className="min-h-48 rounded-2xl border border-stone-200 p-6 dark:border-stone-700">
          <MarkdownPreview content={section.content} empty="Cette section est vide." />
        </div>
      )}
      {section.generatedAt && (
        <p className="text-xs text-stone-400 dark:text-stone-500">
          Dernière génération : {new Date(section.generatedAt).toLocaleString("fr-FR")} avec{" "}
          {section.model || "modèle inconnu"}. Le texte a pu être corrigé depuis.
        </p>
      )}

      {proposal && (
        <section
          aria-label="Proposition de l'IA"
          className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-800 dark:bg-emerald-900/10"
        >
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            <Sparkles className="h-4 w-4" aria-hidden />
            {generating
              ? "Rédaction en cours…"
              : proposal.complete
                ? "Proposition terminée — relis-la avant de l'utiliser"
                : "Proposition incomplète"}
            {proposal.meta?.sources && (
              <span className="font-normal text-stone-500">
                · {proposal.meta.sources.length} notes sources · {proposal.meta.model}
              </span>
            )}
          </div>
          {proposal.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {proposal.error}{" "}
              {proposal.text.trim() ? "Le texte reçu est conservé ci-dessous, marqué comme incomplet." : ""} Ta section
              n'a pas été modifiée.
            </p>
          )}
          <div className="max-h-96 overflow-y-auto rounded-xl bg-white p-4 dark:bg-stone-900">
            <MarkdownPreview content={proposal.text} empty={generating ? "…" : "Aucun texte reçu."} />
          </div>
          {!generating && (
            <div className="flex flex-wrap gap-2">
              {proposal.text.trim() && (
                <>
                  <button
                    type="button"
                    disabled={applying}
                    onClick={() => void apply(true)}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {section.content.trim() ? "Remplacer la section" : "Utiliser ce texte"}
                  </button>
                  {section.content.trim() && (
                    <button
                      type="button"
                      disabled={applying}
                      onClick={() => void apply(false)}
                      className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-800 disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-300"
                    >
                      Ajouter à la suite
                    </button>
                  )}
                </>
              )}
              {!proposal.complete && (
                <button
                  type="button"
                  onClick={() => void generate()}
                  className="flex items-center gap-1 rounded-xl border border-stone-200 px-4 py-2 text-sm dark:border-stone-700 dark:text-stone-300"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden /> Relancer
                </button>
              )}
              <button
                type="button"
                onClick={() => setProposal(null)}
                className="rounded-xl px-4 py-2 text-sm text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                Ignorer
              </button>
            </div>
          )}
          {section.content.trim() && !generating && proposal.text.trim() && (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Remplacer enregistre d'abord une version de ton texte actuel.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export function WriteStep({
  report,
  onSectionChange,
  onApplyGeneration,
}: {
  report: Report;
  onSectionChange: (id: string, changes: Partial<ReportSection>) => void;
  onApplyGeneration: (
    section: ReportSection,
    content: string,
    provenance: ReportProvenance | null,
    replace: boolean,
  ) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState(report.sections[0]?.id ?? "");
  const section = report.sections.find((item) => item.id === selectedId) ?? report.sections[0];

  if (!section) {
    return (
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Le plan est vide. Ajoute au moins une section à l'étape « Plan ».
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
      <nav aria-label="Sections du rapport">
        <ol className="space-y-1">
          {report.sections.map((item, index) => {
            const markers = countToComplete(item.content);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  aria-current={item.id === section.id ? "true" : undefined}
                  className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm ${item.id === section.id ? "bg-emerald-50 font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "text-stone-600 hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800"}`}
                >
                  {item.content.trim() ? (
                    markers ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-label="À compléter" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-label="Rédigée" />
                    )
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-stone-300" aria-label="Vide" />
                  )}
                  <span>
                    {index + 1}. {item.title || "Sans titre"}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <SectionEditor
        key={section.id}
        report={report}
        section={section}
        onChange={(changes) => onSectionChange(section.id, changes)}
        onApplyGeneration={onApplyGeneration}
      />
    </div>
  );
}
