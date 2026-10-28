import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Download, FileDown, History, Loader2, RotateCcw, Save } from "lucide-react";
import { api } from "../../services/api";
import { buildMarkdownPdf, downloadTextFile } from "../../services/pdf";
import { useToast } from "../ui/Toast";
import type { Report, ReportVersion, UserProfile } from "../../types/models";
import { countToComplete } from "../../utils/ai-budget";
import { isCalendarDate } from "../../utils/internship";
import { assembleReportMarkdown, reportToComplete, wordCount } from "../../utils/report";
import { MarkdownPreview } from "./MarkdownPreview";

const day = (date: string) => (isCalendarDate(date) ? format(parseISO(date), "dd MMMM yyyy", { locale: fr }) : date);

function fileName(report: Report, extension: string) {
  const slug = report.title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${slug || "rapport"}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export function ReviewStep({
  report,
  profile,
  flush,
  onValidate,
  onRestored,
}: {
  report: Report;
  profile: UserProfile;
  flush: () => Promise<void>;
  onValidate: (validated: boolean) => void;
  onRestored: (report: Report) => void;
}) {
  const { toast } = useToast();
  const [versions, setVersions] = useState<ReportVersion[] | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const markdown = assembleReportMarkdown(report);
  const toComplete = reportToComplete(report);
  const emptySections = report.sections.filter((section) => !section.content.trim());

  const loadVersions = useCallback(async () => {
    try {
      setVersions(await api.reports.versions(report.id));
    } catch {
      setVersions([]);
    }
  }, [report.id]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  const saveVersion = async () => {
    setBusy(true);
    try {
      await flush();
      await api.reports.saveVersion(report.id, label.trim() || `Version du ${new Date().toLocaleString("fr-FR")}`);
      setLabel("");
      await loadVersions();
      toast("Version enregistrée.", "success");
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "La version n'a pas pu être enregistrée.", "error");
    } finally {
      setBusy(false);
    }
  };

  const restore = async (version: ReportVersion) => {
    if (!window.confirm(`Restaurer « ${version.label} » ? Ton texte actuel sera d'abord enregistré comme version.`))
      return;
    setBusy(true);
    try {
      await flush();
      const current = await api.reports.get(report.id);
      const restored = await api.reports.restoreVersion(report.id, version.id, current.revision);
      onRestored(restored);
      await loadVersions();
      toast("Version restaurée.", "success");
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "La restauration a échoué.", "error");
    } finally {
      setBusy(false);
    }
  };

  const exportMarkdown = async () => {
    await flush();
    downloadTextFile(`# ${report.title}\n\n${markdown}`, fileName(report, "md"));
  };

  const exportPdf = async () => {
    await flush();
    const period =
      isCalendarDate(profile.internshipStart) && isCalendarDate(profile.internshipEnd)
        ? `Du ${day(profile.internshipStart)} au ${day(profile.internshipEnd)}`
        : "";
    buildMarkdownPdf(markdown, {
      breakOnH1: true,
      titlePage: {
        title: report.title,
        subtitle: profile.company,
        lines: [
          profile.displayName,
          [profile.degree, profile.school].filter(Boolean).join(" — "),
          profile.tutorName ? `Tuteur : ${profile.tutorName}` : "",
          period,
          report.status === "validated" && report.validatedAt
            ? `Version validée le ${day(report.validatedAt.slice(0, 10))}`
            : "",
        ],
      },
    }).save(fileName(report, "pdf"));
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="review-check" className="grid gap-4 md:grid-cols-3">
        <h3 id="review-check" className="sr-only">
          Vérifications
        </h3>
        <div className="rounded-2xl bg-stone-50 p-4 dark:bg-stone-800/50">
          <p className="text-2xl font-bold text-stone-900 dark:text-white">{wordCount(markdown)}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">mots · {report.sections.length} sections</p>
        </div>
        <div
          className={`rounded-2xl p-4 ${toComplete ? "bg-amber-50 dark:bg-amber-900/20" : "bg-emerald-50 dark:bg-emerald-900/20"}`}
        >
          <p className="text-2xl font-bold text-stone-900 dark:text-white">{toComplete}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            passage{toComplete > 1 ? "s" : ""} « À compléter »
          </p>
        </div>
        <div
          className={`rounded-2xl p-4 ${emptySections.length ? "bg-amber-50 dark:bg-amber-900/20" : "bg-emerald-50 dark:bg-emerald-900/20"}`}
        >
          <p className="text-2xl font-bold text-stone-900 dark:text-white">{emptySections.length}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            section{emptySections.length > 1 ? "s" : ""} vide{emptySections.length > 1 ? "s" : ""}
          </p>
        </div>
      </section>
      {(toComplete > 0 || emptySections.length > 0) && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-300">
          {report.sections
            .filter((section) => !section.content.trim() || countToComplete(section.content))
            .map((section) => (
              <li key={section.id}>
                {section.title} :{" "}
                {section.content.trim() ? `${countToComplete(section.content)} passage(s) à compléter` : "vide"}
              </li>
            ))}
        </ul>
      )}

      <section
        aria-labelledby="review-validation"
        className="rounded-2xl border border-stone-200 p-5 dark:border-stone-800"
      >
        <h3 id="review-validation" className="mb-2 font-semibold text-stone-900 dark:text-white">
          Validation finale
        </h3>
        {report.status === "validated" ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Tu as validé ce rapport
              {report.validatedAt ? ` le ${new Date(report.validatedAt).toLocaleString("fr-FR")}` : ""}. Toute
              modification le repasse en brouillon.
            </p>
            <button
              type="button"
              onClick={() => onValidate(false)}
              className="text-sm font-medium text-stone-500 underline"
            >
              Repasser en brouillon
            </button>
          </div>
        ) : (
          <label className="flex items-start gap-3 text-sm text-stone-700 dark:text-stone-300">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-emerald-600"
              checked={false}
              onChange={() => {
                if (
                  toComplete &&
                  !window.confirm(`Il reste ${toComplete} passage(s) « À compléter ». Valider quand même ?`)
                )
                  return;
                onValidate(true);
              }}
            />
            J'ai relu ce rapport, corrigé les propositions de l'IA et je valide cette version.
          </label>
        )}
      </section>

      <section aria-labelledby="review-export" className="space-y-3">
        <h3 id="review-export" className="font-semibold text-stone-900 dark:text-white">
          Exporter exactement ce texte
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void exportPdf()}
            className="flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white dark:bg-emerald-600"
          >
            <FileDown className="h-4 w-4" aria-hidden /> Exporter en PDF
          </button>
          <button
            type="button"
            onClick={() => void exportMarkdown()}
            className="flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 dark:border-stone-700 dark:text-stone-300"
          >
            <Download className="h-4 w-4" aria-hidden /> Exporter en Markdown
          </button>
        </div>
        {toComplete > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Les passages « À compléter » restants apparaîtront tels quels dans l'export.
          </p>
        )}
      </section>

      <section aria-labelledby="review-versions" className="space-y-3">
        <h3 id="review-versions" className="flex items-center gap-2 font-semibold text-stone-900 dark:text-white">
          <History className="h-4 w-4" aria-hidden /> Versions
        </h3>
        <div className="flex flex-wrap gap-2">
          <label htmlFor="version-label" className="sr-only">
            Nom de la version
          </label>
          <input
            id="version-label"
            className="min-w-56 flex-1 rounded-xl border border-stone-200 bg-transparent p-2.5 text-sm dark:border-stone-700 dark:text-white"
            placeholder="Nom de la version (ex : envoyée au tuteur)"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveVersion()}
            className="flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}{" "}
            Enregistrer une version
          </button>
        </div>
        {versions === null ? (
          <p className="text-sm text-stone-400">Chargement des versions…</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-stone-400 dark:text-stone-500">Aucune version enregistrée.</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
            {versions.map((version) => (
              <li key={version.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="flex-1 text-stone-700 dark:text-stone-300">
                  <strong>{version.label}</strong>
                  <span className="text-stone-400"> · {new Date(version.createdAt).toLocaleString("fr-FR")}</span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void restore(version)}
                  className="flex items-center gap-1 rounded-lg px-3 py-1 font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden /> Restaurer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="review-provenance"
        className="space-y-2 rounded-2xl bg-stone-50 p-5 text-sm dark:bg-stone-800/40"
      >
        <h3 id="review-provenance" className="font-semibold text-stone-900 dark:text-white">
          Sources et paramètres de la dernière génération
        </h3>
        {report.provenance ? (
          <>
            <p className="text-stone-600 dark:text-stone-300">
              Modèle {report.provenance.model} · {new Date(report.provenance.generatedAt).toLocaleString("fr-FR")} ·{" "}
              {report.provenance.sources.length} note
              {report.provenance.sources.length > 1 ? "s" : ""} source{report.provenance.sources.length > 1 ? "s" : ""}
            </p>
            <pre className="text-xs whitespace-pre-wrap text-stone-500 dark:text-stone-400">
              {report.provenance.instructions}
            </pre>
            <button
              type="button"
              onClick={() => setShowSources((value) => !value)}
              className="font-medium text-emerald-700 underline dark:text-emerald-400"
              aria-expanded={showSources}
            >
              {showSources
                ? "Masquer les notes utilisées"
                : "Voir les notes utilisées (telles qu'au moment de la génération)"}
            </button>
            {showSources && (
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {report.provenance.sources.map((source) => (
                  <li
                    key={source.id}
                    className="rounded-xl bg-white p-3 text-xs whitespace-pre-wrap text-stone-600 dark:bg-stone-900 dark:text-stone-300"
                  >
                    {source.text}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-stone-500 dark:text-stone-400">Aucune génération IA n'a été utilisée dans ce rapport.</p>
        )}
      </section>

      <section aria-labelledby="review-preview" className="space-y-3">
        <h3 id="review-preview" className="flex items-center gap-2 font-semibold text-stone-900 dark:text-white">
          {toComplete > 0 && <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />} Aperçu complet
        </h3>
        <div className="rounded-2xl border border-stone-200 p-6 dark:border-stone-800">
          <h1 className="mb-6 text-2xl font-bold text-stone-900 dark:text-white">{report.title}</h1>
          <MarkdownPreview content={markdown} />
        </div>
      </section>
    </div>
  );
}
