import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Copy,
  Download,
  FileText,
  GraduationCap,
  History,
  Loader2,
  RefreshCw,
  Square,
  Trash2,
} from "lucide-react";
import { api } from "../../services/api";
import { AiRequestError, prepareDefense } from "../../services/ai";
import { exportMarkdownToPDF } from "../../services/pdf";
import { useClipboard } from "../../hooks/useClipboard";
import { useToast } from "../ui/Toast";
import type { AiOutput, DefensePrep, LogEntry } from "../../types/models";
import { CvWorkspace } from "./CvWorkspace";
import { MarkdownPreview } from "../report/MarkdownPreview";

type View =
  | { kind: "home" }
  | { kind: "cv"; output: AiOutput | null }
  | { kind: "defense"; output: AiOutput }
  | { kind: "legacy"; output: AiOutput };

type Props = {
  logs: LogEntry[];
  onNavigate: (tab: "report" | "assistant") => void;
};

const TYPE_LABELS: Record<string, string> = {
  report: "Ancien rapport",
  defense: "Préparation de soutenance",
  cv: "Points CV",
  chat: "Conversation",
};

function parseDefense(content: string): DefensePrep | null {
  try {
    const value = JSON.parse(content) as DefensePrep;
    return Array.isArray(value.plan) && Array.isArray(value.questions) ? value : null;
  } catch {
    return null;
  }
}

function defenseToMarkdown(content: DefensePrep): string {
  const plan = content.plan.map((item, i) => `${i + 1}. ${item}`).join("\n");
  const questions = content.questions.map((q) => `**Q : ${q.question}**\n\nConseil : ${q.answerHint}`).join("\n\n");
  return `## Plan de présentation\n\n${plan}\n\n## Questions probables\n\n${questions}`;
}

function DefenseView({ output }: { output: AiOutput }) {
  const { copied, copy } = useClipboard();
  const prep = parseDefense(output.content);
  if (!prep) return <p className="text-sm text-red-600">Ce résultat ne peut pas être relu.</p>;
  const markdown = defenseToMarkdown(prep);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <p className="flex-1 text-xs text-stone-400 dark:text-stone-500">
          {output.model ? `Modèle ${output.model} · ` : ""}
          {output.sources?.length ? `${output.sources.length} notes sources · ` : ""}
          {format(parseISO(output.createdAt), "dd MMM yyyy, HH:mm", { locale: fr })}
        </p>
        <button
          type="button"
          onClick={() => void copy(markdown)}
          className="flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-700 dark:text-stone-400"
        >
          <Copy className="h-4 w-4" aria-hidden /> {copied ? "Copié !" : "Copier"}
        </button>
        <button
          type="button"
          onClick={() =>
            exportMarkdownToPDF(
              "Préparation de soutenance",
              markdown,
              `Stajio_soutenance_${format(new Date(), "yyyy-MM-dd")}.pdf`,
            )
          }
          className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400"
        >
          <Download className="h-4 w-4" aria-hidden /> Exporter PDF
        </button>
      </div>
      <div>
        <h4 className="mb-4 text-lg font-bold text-stone-900 dark:text-white">Plan de présentation</h4>
        <ol className="space-y-2">
          {prep.plan.map((item, i) => (
            <li key={i} className="flex items-center gap-3 text-stone-700 dark:text-stone-300">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                {i + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      </div>
      <div>
        <h4 className="mb-4 text-lg font-bold text-stone-900 dark:text-white">Questions probables</h4>
        <div className="space-y-4">
          {prep.questions.map((q, i) => (
            <div key={i} className="rounded-2xl bg-stone-50 p-6 dark:bg-stone-800/50">
              <p className="mb-2 font-bold text-stone-900 dark:text-white">Q : {q.question}</p>
              <p className="text-sm text-stone-600 italic dark:text-stone-400">Conseil : {q.answerHint}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ToolsTab({ logs, onNavigate }: Props) {
  const { toast } = useToast();
  const [view, setView] = useState<View>({ kind: "home" });
  const [history, setHistory] = useState<AiOutput[]>([]);
  const [defenseLoading, setDefenseLoading] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setHistory(await api.aiOutputs.list());
    } catch {
      // L'historique n'est pas critique : l'onglet reste utilisable.
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
    return () => controller.current?.abort();
  }, [fetchHistory]);

  const runDefense = async () => {
    if (!logs.length) {
      toast("Ajoute d'abord des notes de journal : l'IA se base dessus.", "info");
      return;
    }
    const current = new AbortController();
    controller.current = current;
    setDefenseLoading(true);
    setError("");
    try {
      const response = await prepareDefense(undefined, current.signal);
      const { output } = await api.aiOutputs.save({
        type: "defense",
        title: `Préparation de soutenance — ${format(new Date(), "dd MMMM yyyy à HH:mm", { locale: fr })}`,
        content: JSON.stringify(response.result),
        model: response.model,
        instructions: response.instructions ?? null,
        sources: response.sources ?? null,
      });
      await fetchHistory();
      setView({ kind: "defense", output });
    } catch (cause) {
      if (!(cause instanceof AiRequestError && cause.cancelled)) {
        setError(cause instanceof Error ? cause.message : "La génération a échoué.");
      }
    } finally {
      setDefenseLoading(false);
    }
  };

  const open = (output: AiOutput) => {
    if (output.type === "cv") setView({ kind: "cv", output });
    else if (output.type === "defense") setView({ kind: "defense", output });
    else setView({ kind: "legacy", output });
  };

  const remove = async (output: AiOutput) => {
    if (!window.confirm(`Supprimer « ${output.title} » ?`)) return;
    try {
      await api.aiOutputs.delete(output.id);
      await fetchHistory();
      if (view.kind !== "home" && "output" in view && view.output?.id === output.id) setView({ kind: "home" });
    } catch {
      toast("Erreur lors de la suppression.", "error");
    }
  };

  const cards = [
    {
      key: "report",
      icon: <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" aria-hidden />,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      title: "Rapport de stage",
      desc: "Brief, plan modifiable, rédaction par section, versions et export PDF.",
      action: () => onNavigate("report"),
    },
    {
      key: "defense",
      icon: defenseLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden />
      ) : (
        <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden />
      ),
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      title: "Prépa soutenance",
      desc: "Plan de présentation et questions probables du jury.",
      action: () => void runDefense(),
    },
    {
      key: "cv",
      icon: <Briefcase className="h-6 w-6 text-purple-600 dark:text-purple-400" aria-hidden />,
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      title: "Expérience → CV",
      desc: "Choisis tes expériences, génère des points CV puis corrige-les.",
      action: () => setView({ kind: "cv", output: null }),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl"
    >
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-3xl font-bold text-stone-900 dark:text-white">Outils IA</h2>
        {view.kind !== "home" && (
          <button
            type="button"
            onClick={() => setView({ kind: "home" })}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Retour aux outils
          </button>
        )}
      </div>

      {view.kind === "home" && (
        <>
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {cards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={card.action}
                disabled={defenseLoading}
                className="group rounded-3xl border border-stone-200 bg-white p-8 text-left shadow-sm transition-all hover:border-emerald-500 disabled:opacity-60 dark:border-stone-800 dark:bg-stone-900"
              >
                <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl ${card.iconBg}`}>
                  {card.icon}
                </div>
                <h3 className="mb-2 text-lg font-bold text-stone-900 dark:text-white">{card.title}</h3>
                <p className="text-sm text-stone-500 dark:text-stone-400">{card.desc}</p>
              </button>
            ))}
          </div>
          {defenseLoading && (
            <div
              className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-900/20 dark:text-blue-200"
              role="status"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> L'IA prépare ta soutenance…
              <button
                type="button"
                onClick={() => controller.current?.abort()}
                className="flex items-center gap-1 rounded-lg border border-blue-300 px-3 py-1 text-xs font-medium"
              >
                <Square className="h-3 w-3" aria-hidden /> Annuler
              </button>
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="mb-8 flex items-start gap-4 rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20"
            >
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-500" aria-hidden />
              <div className="flex-1">
                <p className="mb-1 font-semibold text-red-700 dark:text-red-400">La génération a échoué</p>
                <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => void runDefense()}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white"
              >
                <RefreshCw className="h-4 w-4" aria-hidden /> Réessayer
              </button>
            </div>
          )}
          <section
            aria-labelledby="tools-history"
            className="rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900"
          >
            <h3
              id="tools-history"
              className="flex items-center gap-2 border-b border-stone-100 p-4 font-semibold text-stone-900 dark:border-stone-800 dark:text-white"
            >
              <History className="h-4 w-4" aria-hidden /> Résultats enregistrés ({history.length})
            </h3>
            {history.length === 0 && (
              <p className="p-6 text-sm text-stone-400 dark:text-stone-500">
                Aucun résultat enregistré pour l'instant.
              </p>
            )}
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {history.map((output) => (
                <li key={output.id} className="flex items-center gap-3 p-4">
                  <button type="button" onClick={() => open(output)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-semibold text-stone-800 hover:text-emerald-600 dark:text-stone-200">
                      {output.title}
                    </p>
                    <p className="text-xs text-stone-400 dark:text-stone-500">
                      {TYPE_LABELS[output.type] ?? output.type} ·{" "}
                      {format(parseISO(output.createdAt), "dd MMM yyyy, HH:mm", { locale: fr })}
                      {output.updatedAt ? " · corrigé" : ""}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(output)}
                    aria-label={`Supprimer ${output.title}`}
                    className="shrink-0 rounded-lg p-1.5 text-stone-300 hover:text-red-500 dark:text-stone-600"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {view.kind === "cv" && (
        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8 dark:border-stone-800 dark:bg-stone-900">
          <h3 className="mb-6 text-2xl font-bold text-stone-900 dark:text-white">Points CV</h3>
          <CvWorkspace
            key={view.output?.id ?? "new"}
            logs={logs}
            editing={view.output}
            onSaved={() => void fetchHistory()}
          />
        </div>
      )}
      {view.kind === "defense" && (
        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8 dark:border-stone-800 dark:bg-stone-900">
          <h3 className="mb-6 text-2xl font-bold text-stone-900 dark:text-white">Ta préparation de soutenance</h3>
          <DefenseView output={view.output} />
          <button
            type="button"
            onClick={() => onNavigate("assistant")}
            className="mt-8 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            S'entraîner avec une simulation
          </button>
        </div>
      )}
      {view.kind === "legacy" && (
        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8 dark:border-stone-800 dark:bg-stone-900">
          <h3 className="mb-2 text-2xl font-bold text-stone-900 dark:text-white">{view.output.title}</h3>
          <p className="mb-6 text-sm text-stone-500 dark:text-stone-400">
            Résultat d'une ancienne version de Stajio, conservé en lecture seule.
          </p>
          <MarkdownPreview content={view.output.content} />
        </div>
      )}
    </motion.div>
  );
}
