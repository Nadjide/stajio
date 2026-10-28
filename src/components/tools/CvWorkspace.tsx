import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, Download, Loader2, Save, Sparkles, Square } from "lucide-react";
import { api } from "../../services/api";
import { AiRequestError, generateCVPoints, type GenerationMeta } from "../../services/ai";
import { downloadTextFile } from "../../services/pdf";
import { useToast } from "../ui/Toast";
import type { AiOutput, LogEntry } from "../../types/models";
import { countToComplete } from "../../utils/ai-budget";
import { isCalendarDate } from "../../utils/internship";
import { MarkdownPreview } from "../report/MarkdownPreview";

const day = (date: string) => (isCalendarDate(date) ? format(parseISO(date), "dd MMM yyyy", { locale: fr }) : date);

/** Generated points are a starting text: the student edits and saves the final wording. */
export function CvWorkspace({
  logs,
  editing,
  onSaved,
}: {
  logs: LogEntry[];
  editing: AiOutput | null;
  onSaved: (output: AiOutput) => void;
}) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [text, setText] = useState(editing?.content ?? "");
  const [title, setTitle] = useState(editing?.title ?? "Points CV");
  const [meta, setMeta] = useState<GenerationMeta | null>(null);
  const [savedId, setSavedId] = useState<string | null>(editing?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [estimate, setEstimate] = useState<{ estimatedTokens: number; budgetTokens: number; fits: boolean } | null>(
    null,
  );
  const controller = useRef<AbortController | null>(null);
  const sources = editing?.sources ?? meta?.sources ?? [];

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return [...logs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((log) => !query || `${log.rawContent} ${log.summary ?? ""}`.toLowerCase().includes(query));
  }, [logs, filter]);

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    if (!selected.length) return;
    let active = true;
    const timer = setTimeout(() => {
      api.ai
        .estimate({ task: "cv", logIds: selected })
        .then((result) => active && setEstimate(result))
        .catch(() => active && setEstimate(null));
    }, 600);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selected]);

  const generate = async () => {
    if (!selected.length) return;
    if (text.trim() && dirty && !window.confirm("Remplacer le texte non enregistré par une nouvelle génération ?"))
      return;
    const current = new AbortController();
    controller.current = current;
    setGenerating(true);
    setError("");
    setSavedId(null);
    setText("");
    try {
      const result = await generateCVPoints(selected, { signal: current.signal, onText: setText, onMeta: setMeta });
      setText(result.text.trim());
    } catch (cause) {
      const partial = cause instanceof AiRequestError ? cause.partial : "";
      setText(partial.trim() ? `${partial.trim()}\n\n[À compléter : génération interrompue]` : "");
      setError(cause instanceof Error ? cause.message : "La génération a échoué.");
    } finally {
      setGenerating(false);
      setDirty(true);
    }
  };

  const save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const output = savedId
        ? await api.aiOutputs.update(savedId, { title: title.trim() || "Points CV", content: text })
        : (
            await api.aiOutputs.save({
              type: "cv",
              title: title.trim() || "Points CV",
              content: text,
              model: meta?.model ?? null,
              instructions: meta?.instructions ?? null,
              sources: meta?.sources ?? null,
            })
          ).output;
      setSavedId(output.id);
      setDirty(false);
      onSaved(output);
      toast("Points CV enregistrés.", "success");
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "L'enregistrement a échoué. Ton texte est conservé.", "error");
    } finally {
      setSaving(false);
    }
  };

  const markers = countToComplete(text);

  return (
    <div className="space-y-6">
      {!editing && (
        <section aria-labelledby="cv-sources" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 id="cv-sources" className="font-semibold text-stone-900 dark:text-white">
              Expériences à valoriser ({selected.length} sélectionnée{selected.length > 1 ? "s" : ""})
            </h4>
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                onClick={() => setSelected(visible.map((log) => log.id))}
                className="font-medium text-emerald-700 dark:text-emerald-400"
              >
                Tout sélectionner
              </button>
              <button type="button" onClick={() => setSelected([])} className="font-medium text-stone-500">
                Aucune
              </button>
            </div>
          </div>
          <label htmlFor="cv-filter" className="sr-only">
            Filtrer les notes
          </label>
          <input
            id="cv-filter"
            type="search"
            className="w-full rounded-xl border border-stone-200 bg-transparent p-2.5 text-sm dark:border-stone-700 dark:text-white"
            placeholder="Filtrer les notes…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-stone-200 p-2 dark:border-stone-800">
            {visible.map((log) => (
              <li key={log.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 text-sm hover:bg-stone-50 dark:hover:bg-stone-800/50">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-purple-600"
                    checked={selected.includes(log.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked ? [...current, log.id] : current.filter((id) => id !== log.id),
                      )
                    }
                  />
                  <span>
                    <span className="font-medium text-stone-800 dark:text-stone-200">{day(log.date)}</span>{" "}
                    <span className="text-stone-500 dark:text-stone-400">
                      — {(log.summary || log.rawContent).slice(0, 140)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
            {visible.length === 0 && <li className="p-2 text-sm text-stone-400">Aucune note.</li>}
          </ul>
          {estimate && selected.length > 0 && !estimate.fits && (
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              Sélection trop grande pour le modèle (≈ {estimate.estimatedTokens} jetons sur {estimate.budgetTokens}).
              Décoche des notes.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void generate()}
              disabled={!selected.length || generating || (estimate ? !estimate.fits : false)}
              className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden />
              )}
              Générer les points CV
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
          </div>
        </section>
      )}

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {error}
          {text.trim() ? " Le texte reçu est conservé et marqué comme incomplet." : ""}
        </p>
      )}

      {(text || generating) && (
        <section aria-labelledby="cv-result" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 id="cv-result" className="sr-only">
              Points CV
            </h4>
            <label htmlFor="cv-title" className="sr-only">
              Titre
            </label>
            <input
              id="cv-title"
              className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-transparent p-2.5 text-sm font-semibold dark:border-stone-700 dark:text-white"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setDirty(true);
              }}
            />
            {markers > 0 && (
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                {markers} chiffre(s) ou résultat(s) à préciser
              </span>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label htmlFor="cv-text" className="mb-1 block text-xs font-semibold text-stone-500 dark:text-stone-400">
                Texte (modifiable)
              </label>
              <textarea
                id="cv-text"
                className="h-72 w-full resize-y rounded-2xl border border-stone-200 bg-transparent p-4 font-mono text-sm dark:border-stone-700 dark:text-stone-100"
                value={text}
                readOnly={generating}
                onChange={(event) => {
                  setText(event.target.value);
                  setDirty(true);
                }}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-stone-500 dark:text-stone-400">Aperçu</p>
              <div className="h-72 overflow-y-auto rounded-2xl border border-stone-200 p-4 dark:border-stone-700">
                <MarkdownPreview content={text} empty="…" />
              </div>
            </div>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Remplace chaque « [À compléter : …] » par un chiffre ou un résultat réel, ou supprime la mention. Stajio
            n'invente aucun chiffre.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || generating || !text.trim()}
              className="flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-emerald-600"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              {savedId ? "Enregistrer les corrections" : "Enregistrer"}
            </button>
            <button
              type="button"
              disabled={!text.trim()}
              onClick={() => downloadTextFile(`# ${title}\n\n${text}\n`, "points-cv.md")}
              className="flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2 text-sm dark:border-stone-700 dark:text-stone-300"
            >
              <Download className="h-4 w-4" aria-hidden /> Markdown
            </button>
            <button
              type="button"
              disabled={!text.trim()}
              onClick={() =>
                downloadTextFile(
                  `${title}\n\n${text.replace(/^[-*]\s+/gm, "• ")}\n`,
                  "points-cv.txt",
                  "text/plain;charset=utf-8",
                )
              }
              className="flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2 text-sm dark:border-stone-700 dark:text-stone-300"
            >
              <Download className="h-4 w-4" aria-hidden /> Texte
            </button>
            {dirty && savedId && (
              <span className="self-center text-xs text-amber-700 dark:text-amber-400">
                Corrections non enregistrées
              </span>
            )}
          </div>
        </section>
      )}

      {sources.length > 0 && (
        <details className="rounded-2xl bg-stone-50 p-4 text-sm dark:bg-stone-800/40">
          <summary className="cursor-pointer font-medium text-stone-700 dark:text-stone-300">
            {sources.length} note{sources.length > 1 ? "s" : ""} source{sources.length > 1 ? "s" : ""}
            {(editing?.model ?? meta?.model) ? ` · modèle ${editing?.model ?? meta?.model}` : ""}
          </summary>
          <ul className="mt-3 space-y-2">
            {sources.map((source) => (
              <li
                key={source.id}
                className="rounded-xl bg-white p-3 text-xs whitespace-pre-wrap text-stone-600 dark:bg-stone-900 dark:text-stone-300"
              >
                {source.text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
