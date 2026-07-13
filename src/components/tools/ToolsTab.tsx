import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  Briefcase,
  Copy,
  Download,
  FileText,
  GraduationCap,
  History,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Markdown from "react-markdown";
import { api } from "../../services/api";
import { generateCVPoints, generateReport, prepareDefense } from "../../services/ai";
import { exportMarkdownToPDF } from "../../services/pdf";
import { useClipboard } from "../../hooks/useClipboard";
import { useToast } from "../ui/Toast";
import type { AiOutput, DefensePrep, LogEntry, UserProfile } from "../../types/models";

type ToolType = "report" | "defense" | "cv";

type AiResult =
  | { type: "report" | "cv"; content: string }
  | { type: "defense"; content: DefensePrep };

type Props = {
  profile: UserProfile;
  logs: LogEntry[];
};

const TOOL_TITLES: Record<ToolType, string> = {
  report: "Rapport de stage",
  defense: "Préparation de soutenance",
  cv: "Points CV",
};

function defenseToMarkdown(content: DefensePrep): string {
  const plan = content.plan.map((item, i) => `${i + 1}. ${item}`).join("\n");
  const questions = content.questions
    .map((q) => `**Q: ${q.question}**\n\nConseil: ${q.answerHint}`)
    .join("\n\n");
  return `## Plan de présentation\n\n${plan}\n\n## Questions probables\n\n${questions}`;
}

export function ToolsTab({ profile, logs }: Props) {
  const { toast } = useToast();
  const { copied, copy } = useClipboard();
  const [loadingTool, setLoadingTool] = useState<ToolType | null>(null);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [error, setError] = useState<{ message: string; tool: ToolType } | null>(null);
  const [history, setHistory] = useState<AiOutput[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const outputs = await api.aiOutputs.list();
      setHistory(outputs);
    } catch {
      // L'historique n'est pas critique: on ignore silencieusement
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const saveToHistory = async (type: ToolType, content: string) => {
    try {
      await api.aiOutputs.save({
        type,
        title: `${TOOL_TITLES[type]} — ${format(new Date(), "dd MMMM yyyy à HH:mm", { locale: fr })}`,
        content,
      });
      fetchHistory();
    } catch {
      toast("Résultat généré, mais impossible de l'enregistrer dans l'historique.", "error");
    }
  };

  const runAITool = async (tool: ToolType) => {
    if (logs.length === 0) {
      toast("Ajoute d'abord des entrées de journal: l'IA se base dessus.", "info");
      return;
    }
    setLoadingTool(tool);
    setAiResult(null);
    setError(null);
    setStreamingText(tool === "defense" ? null : "");

    try {
      if (tool === "defense") {
        const result = await prepareDefense(profile, logs);
        setAiResult({ type: "defense", content: result });
        await saveToHistory("defense", JSON.stringify(result));
      } else {
        const run = tool === "report" ? generateReport(profile, logs, setStreamingText) : generateCVPoints(logs, setStreamingText);
        const fullText = await run;
        setAiResult({ type: tool, content: fullText });
        await saveToHistory(tool, fullText);
      }
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "Erreur lors de la génération.",
        tool,
      });
    } finally {
      setLoadingTool(null);
      setStreamingText(null);
    }
  };

  const openFromHistory = (output: AiOutput) => {
    setError(null);
    if (output.type === "defense") {
      try {
        setAiResult({ type: "defense", content: JSON.parse(output.content) as DefensePrep });
      } catch {
        toast("Impossible de relire ce résultat.", "error");
      }
    } else if (output.type === "report" || output.type === "cv") {
      setAiResult({ type: output.type, content: output.content });
    }
    setShowHistory(false);
  };

  const deleteFromHistory = async (id: string) => {
    try {
      await api.aiOutputs.delete(id);
      fetchHistory();
    } catch {
      toast("Erreur lors de la suppression.", "error");
    }
  };

  const resultAsMarkdown = (): string => {
    if (!aiResult) return "";
    return aiResult.type === "defense" ? defenseToMarkdown(aiResult.content) : aiResult.content;
  };

  const exportPDF = () => {
    if (!aiResult) return;
    exportMarkdownToPDF(
      TOOL_TITLES[aiResult.type],
      resultAsMarkdown(),
      `Stajio_${aiResult.type}_${format(new Date(), "yyyy-MM-dd")}.pdf`,
    );
  };

  const copyToClipboard = async () => {
    if (!aiResult) return;
    await copy(resultAsMarkdown());
  };

  const toolCards: Array<{ tool: ToolType; icon: React.ReactNode; iconBg: string; title: string; desc: string }> = [
    {
      tool: "report",
      icon: <FileText className="text-emerald-600 dark:text-emerald-400 w-6 h-6 group-hover:text-white" />,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30 group-hover:bg-emerald-600",
      title: "Rapport de stage",
      desc: "Génère un brouillon complet basé sur ton journal, en direct.",
    },
    {
      tool: "defense",
      icon: <GraduationCap className="text-blue-600 dark:text-blue-400 w-6 h-6 group-hover:text-white" />,
      iconBg: "bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-600",
      title: "Prépa Soutenance",
      desc: "Plan de présentation et questions types du jury.",
    },
    {
      tool: "cv",
      icon: <Briefcase className="text-purple-600 dark:text-purple-400 w-6 h-6 group-hover:text-white" />,
      iconBg: "bg-purple-100 dark:bg-purple-900/30 group-hover:bg-purple-600",
      title: "Expérience → CV",
      desc: "Transforme tes missions en bullet points ATS.",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl"
    >
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-stone-900 dark:text-white">Outils IA</h2>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
            showHistory
              ? "bg-emerald-600 text-white"
              : "bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:border-emerald-300"
          }`}
        >
          <History className="w-4 h-4" />
          Historique ({history.length})
        </button>
      </div>

      {showHistory && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm mb-8 divide-y divide-stone-100 dark:divide-stone-800"
        >
          {history.length === 0 && (
            <p className="p-6 text-sm text-stone-400 dark:text-stone-500">
              Aucune génération enregistrée pour l'instant. Lance un outil ci-dessous !
            </p>
          )}
          {history.map((output) => (
            <div key={output.id} className="flex items-center gap-3 p-4 group">
              <button onClick={() => openFromHistory(output)} className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold text-stone-800 dark:text-stone-200 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {output.title}
                </p>
                <p className="text-xs text-stone-400 dark:text-stone-500">
                  {format(parseISO(output.createdAt), "dd MMM yyyy, HH:mm", { locale: fr })}
                </p>
              </button>
              <button
                onClick={() => deleteFromHistory(output.id)}
                className="text-stone-300 dark:text-stone-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {toolCards.map(({ tool, icon, iconBg, title, desc }) => (
          <button
            key={tool}
            onClick={() => runAITool(tool)}
            disabled={loadingTool !== null}
            className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm hover:border-emerald-500 dark:hover:border-emerald-500 transition-all text-left group disabled:opacity-60"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-colors ${iconBg}`}>
              {loadingTool === tool ? <Loader2 className="w-6 h-6 animate-spin text-stone-400" /> : icon}
            </div>
            <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">{title}</h3>
            <p className="text-sm text-stone-500 dark:text-stone-400">{desc}</p>
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 mb-8 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-700 dark:text-red-400 mb-1">La génération a échoué</p>
            <p className="text-sm text-red-600 dark:text-red-300">{error.message}</p>
          </div>
          <button
            onClick={() => runAITool(error.tool)}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-700 transition-all shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </button>
        </div>
      )}

      {/* Affichage en streaming */}
      {loadingTool && streamingText !== null && (
        <div className="bg-white dark:bg-stone-900 p-8 md:p-12 rounded-3xl border border-emerald-200 dark:border-emerald-800 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Loader2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-spin" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Génération en direct...
            </p>
          </div>
          <div className="prose prose-stone dark:prose-invert max-w-none">
            <Markdown>{streamingText || "..."}</Markdown>
          </div>
        </div>
      )}

      {loadingTool === "defense" && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 animate-spin mb-4" />
          <p className="text-stone-500 dark:text-stone-400 animate-pulse">L'IA prépare ta soutenance...</p>
        </div>
      )}

      {aiResult && !loadingTool && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-stone-900 p-8 md:p-12 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <h3 className="text-2xl font-bold text-stone-900 dark:text-white">
              {aiResult.type === "report" && "Ton Rapport de Stage"}
              {aiResult.type === "defense" && "Ta Préparation de Soutenance"}
              {aiResult.type === "cv" && "Tes Points CV"}
            </h3>
            <div className="flex items-center gap-4">
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 text-stone-500 dark:text-stone-400 font-medium hover:text-stone-700 dark:hover:text-stone-300 text-sm"
              >
                <Copy className="w-4 h-4" />
                {copied ? "Copié !" : "Copier"}
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

          <div className="prose prose-stone dark:prose-invert max-w-none">
            {aiResult.type === "defense" ? (
              <div className="space-y-8 not-prose">
                <div>
                  <h4 className="text-lg font-bold mb-4 text-stone-900 dark:text-white">Plan de présentation</h4>
                  <ul className="space-y-2">
                    {aiResult.content.plan.map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-stone-700 dark:text-stone-300">
                        <span className="w-6 h-6 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center text-xs font-bold text-stone-500 dark:text-stone-400 shrink-0">
                          {i + 1}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-bold mb-4 text-stone-900 dark:text-white">Questions probables</h4>
                  <div className="space-y-4">
                    {aiResult.content.questions.map((q, i) => (
                      <div key={i} className="bg-stone-50 dark:bg-stone-800/50 p-6 rounded-2xl">
                        <p className="font-bold text-stone-900 dark:text-white mb-2">Q: {q.question}</p>
                        <p className="text-stone-600 dark:text-stone-400 text-sm italic">Conseil: {q.answerHint}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Markdown>{aiResult.content}</Markdown>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
