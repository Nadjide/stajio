import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Link2, Loader2, Pencil, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { api } from "../../services/api";
import { AiRequestError, structureLog } from "../../services/ai";
import { DRAFT_STATUS_LABELS, useDraft } from "../../hooks/useDraft";
import { useToast } from "../ui/Toast";
import type { LogEntry, Skill, UserProfile } from "../../types/models";
import {
  getInternshipProgress,
  getInternshipWeek,
  getInternshipWeekLabel,
  isCalendarDate,
} from "../../utils/internship";
import { fieldsFromLog, inputClass, structuredPayload, type StructuredFields } from "./noteFields";
import { needsPeriodConfirmation, PeriodWarning } from "./PeriodWarning";
import { StructuredFieldsForm } from "./StructuredFieldsForm";

type Props = {
  log: LogEntry;
  profile: UserProfile;
  skills: Skill[];
  autoStructure?: boolean;
  onChanged: () => Promise<void>;
  onSkillsChanged: () => Promise<void>;
};

type EditDraft = { date: string; rawContent: string; fields: StructuredFields };
const isEditUnchanged = () => false;

function EditNoteForm({
  log,
  profile,
  onDone,
  onChanged,
}: {
  log: LogEntry;
  profile: UserProfile;
  onDone: () => void;
  onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const draft = useDraft<EditDraft>(
    `journal:edit:${log.id}`,
    { date: log.date, rawContent: log.rawContent, fields: fieldsFromLog(log) },
    isEditUnchanged,
  );
  const [confirmedDate, setConfirmedDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { date, rawContent, fields } = draft.value;
  const dateChanged = date !== log.date;
  const needsConfirmation = dateChanged && needsPeriodConfirmation(date, profile) && confirmedDate !== date;

  const save = async () => {
    if (!rawContent.trim() || !isCalendarDate(date) || needsConfirmation) return;
    setSaving(true);
    setError("");
    try {
      await api.logs.update(log.id, { date, rawContent: rawContent.trim(), ...structuredPayload(fields) });
      await draft.clear();
      await onChanged();
      toast("Note mise à jour.", "success");
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La mise à jour a échoué.");
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    await draft.clear();
    onDone();
  };

  return (
    <div className="space-y-4">
      {draft.restored && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
          Tes modifications non enregistrées ont été restaurées.
        </p>
      )}
      <div className="space-y-1">
        <label htmlFor={`edit-date-${log.id}`} className="text-xs font-semibold text-stone-500 dark:text-stone-400">
          Date de l'activité
        </label>
        <input
          id={`edit-date-${log.id}`}
          type="date"
          className={`${inputClass} md:w-56`}
          value={date}
          onChange={(event) => draft.setValue((previous) => ({ ...previous, date: event.target.value }))}
        />
      </div>
      {dateChanged && (
        <PeriodWarning
          id={`edit-confirm-${log.id}`}
          date={date}
          profile={profile}
          confirmed={confirmedDate === date}
          onConfirm={(checked) => setConfirmedDate(checked ? date : "")}
        />
      )}
      <div className="space-y-1">
        <label htmlFor={`edit-raw-${log.id}`} className="text-xs font-semibold text-stone-500 dark:text-stone-400">
          Texte d'origine
        </label>
        <textarea
          id={`edit-raw-${log.id}`}
          className={`${inputClass} h-32 resize-y`}
          value={rawContent}
          onChange={(event) => draft.setValue((previous) => ({ ...previous, rawContent: event.target.value }))}
        />
      </div>
      <StructuredFieldsForm
        idPrefix={`edit-${log.id}`}
        fields={fields}
        onChange={(next) => draft.setValue((previous) => ({ ...previous, fields: next }))}
      />
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error} Tes modifications sont conservées.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="mr-auto text-xs text-stone-400 dark:text-stone-500" aria-live="polite">
          {DRAFT_STATUS_LABELS[draft.status]}
        </span>
        <button
          type="button"
          onClick={cancel}
          className="rounded-xl px-4 py-2 text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800"
        >
          Annuler les modifications
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !rawContent.trim() || !isCalendarDate(date) || needsConfirmation}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Enregistrer
        </button>
      </div>
    </div>
  );
}

/** The AI result is a proposal: it is reviewed and only then applied, never over the raw text. */
function StructurePanel({
  log,
  onDone,
  onChanged,
}: {
  log: LogEntry;
  onDone: () => void;
  onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [proposal, setProposal] = useState<StructuredFields | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const controller = useRef<AbortController | null>(null);

  const run = async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setError("");
    try {
      const { result } = await structureLog(log.rawContent, current.signal);
      setProposal({
        summary: result.summary,
        missions: result.missions.join("\n"),
        technologies: result.technologies.join(", "),
        skills: result.skills.join(", "),
      });
    } catch (cause) {
      // A superseded or unmounted request is not an error to show.
      if (controller.current !== current || (cause instanceof AiRequestError && cause.cancelled)) return;
      setError(cause instanceof Error ? cause.message : "La structuration a échoué.");
    } finally {
      if (controller.current === current) setLoading(false);
    }
  };

  useEffect(() => {
    // Starting the request is the purpose of opening this panel.
    void run();
    return () => controller.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = async () => {
    if (!proposal) return;
    setApplying(true);
    try {
      await api.logs.update(log.id, structuredPayload(proposal));
      await onChanged();
      toast("Proposition appliquée. Ton texte d'origine est inchangé.", "success");
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La proposition n'a pas pu être enregistrée.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-800 dark:bg-emerald-900/10">
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
        <Sparkles className="h-4 w-4" aria-hidden /> Proposition de l'IA — vérifie et corrige avant d'appliquer
      </p>
      {loading && (
        <div
          className="flex flex-wrap items-center gap-3 text-sm text-stone-600 dark:text-stone-300"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Structuration en cours…
          <button
            type="button"
            onClick={() => {
              controller.current?.abort();
              onDone();
            }}
            className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-medium dark:border-stone-600"
          >
            Annuler
          </button>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
        >
          <span className="flex-1">{error} Ta note n'a pas été modifiée.</span>
          <button
            type="button"
            onClick={() => void run()}
            className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white"
          >
            <RefreshCw className="h-3 w-3" aria-hidden /> Réessayer
          </button>
        </div>
      )}
      {proposal && (
        <StructuredFieldsForm idPrefix={`ai-${log.id}`} fields={proposal} onChange={setProposal} disabled={applying} />
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            controller.current?.abort();
            onDone();
          }}
          className="rounded-xl px-4 py-2 text-sm text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800"
        >
          Ignorer
        </button>
        {proposal && (
          <button
            type="button"
            onClick={() => void apply()}
            disabled={applying}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {applying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Appliquer la proposition
          </button>
        )}
      </div>
    </div>
  );
}

function SkillLinker({
  log,
  skills,
  onSkillsChanged,
}: {
  log: LogEntry;
  skills: Skill[];
  onSkillsChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const linked = skills.filter((skill) => skill.logIds.includes(log.id));
  const available = skills.filter((skill) => !skill.logIds.includes(log.id));

  const change = async (skill: Skill, link: boolean) => {
    setBusy(true);
    try {
      await api.skills.update(skill.id, {
        logIds: link ? [...skill.logIds, log.id] : skill.logIds.filter((id) => id !== log.id),
      });
      await onSkillsChanged();
      setChoice("");
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "Le lien n'a pas pu être enregistré.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-4 dark:border-stone-800">
      <span className="flex items-center gap-1 text-xs font-semibold text-stone-500 dark:text-stone-400">
        <Link2 className="h-3.5 w-3.5" aria-hidden /> Preuve de :
      </span>
      {linked.length === 0 && <span className="text-xs text-stone-400 dark:text-stone-500">aucune compétence</span>}
      {linked.map((skill) => (
        <span
          key={skill.id}
          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white"
        >
          {skill.label}
          <button
            type="button"
            disabled={busy}
            onClick={() => void change(skill, false)}
            aria-label={`Retirer cette note des preuves de ${skill.label}`}
            className="rounded hover:bg-emerald-700"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ))}
      {available.length > 0 && (
        <span className="flex items-center gap-2">
          <label htmlFor={`link-skill-${log.id}`} className="sr-only">
            Associer une compétence à cette note
          </label>
          <select
            id={`link-skill-${log.id}`}
            className="rounded-lg border border-stone-200 bg-transparent px-2 py-1 text-xs dark:border-stone-700 dark:text-stone-200"
            value={choice}
            disabled={busy}
            onChange={(event) => setChoice(event.target.value)}
          >
            <option value="" className="dark:bg-stone-900">
              Associer une compétence…
            </option>
            {available.map((skill) => (
              <option key={skill.id} value={skill.id} className="dark:bg-stone-900">
                {skill.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!choice || busy}
            onClick={() => {
              const skill = available.find((item) => item.id === choice);
              if (skill) void change(skill, true);
            }}
            className="rounded-lg bg-stone-900 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40 dark:bg-emerald-700"
          >
            Associer
          </button>
        </span>
      )}
    </div>
  );
}

export function NoteCard({ log, profile, skills, autoStructure, onChanged, onSkillsChanged }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"view" | "edit" | "structure">(autoStructure ? "structure" : "view");
  const { totalWeeks } = getInternshipProgress(profile.internshipStart, profile.internshipEnd);
  const week = getInternshipWeek(log.date, profile.internshipStart);
  const hasStructure = !!(log.summary || log.missions?.length || log.technologies?.length || log.skills?.length);

  const remove = async () => {
    if (!window.confirm("Supprimer définitivement cette note ? Ses liens de preuve seront aussi retirés.")) return;
    try {
      await api.logs.delete(log.id);
      await Promise.all([onChanged(), onSkillsChanged()]);
      toast("Note supprimée.", "success");
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "Erreur lors de la suppression.", "error");
    }
  };

  const iconButton =
    "rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-stone-500 dark:hover:bg-stone-800";

  return (
    <article
      aria-labelledby={`note-title-${log.id}`}
      className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8 dark:border-stone-800 dark:bg-stone-900"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
            {getInternshipWeekLabel(week, totalWeeks)}
          </span>
          <h3 id={`note-title-${log.id}`} className="mt-1 text-xl font-bold text-stone-900 dark:text-white">
            {isCalendarDate(log.date) ? format(parseISO(log.date), "dd MMMM yyyy", { locale: fr }) : "Date à vérifier"}
          </h3>
        </div>
        {mode === "view" && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setMode("structure")}
              className={`${iconButton} hover:text-emerald-600`}
              aria-label="Structurer avec l'IA"
              title="Structurer avec l'IA"
            >
              <Sparkles className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setMode("edit")}
              className={`${iconButton} hover:text-emerald-600`}
              aria-label="Modifier la note"
              title="Modifier"
            >
              <Pencil className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              className={`${iconButton} hover:text-red-600`}
              aria-label="Supprimer la note"
              title="Supprimer"
            >
              <Trash2 className="h-5 w-5" aria-hidden />
            </button>
          </div>
        )}
      </div>

      {mode === "edit" ? (
        <EditNoteForm log={log} profile={profile} onDone={() => setMode("view")} onChanged={onChanged} />
      ) : (
        <>
          <p className="leading-relaxed whitespace-pre-wrap text-stone-700 dark:text-stone-200">{log.rawContent}</p>
          {hasStructure && (
            <div className="mt-5 space-y-3 rounded-2xl bg-stone-50 p-4 dark:bg-stone-800/40">
              {log.summary && log.summary !== log.rawContent && (
                <p className="text-sm text-stone-600 dark:text-stone-300">
                  <span className="font-semibold">Résumé : </span>
                  {log.summary}
                </p>
              )}
              {(log.missions?.length ?? 0) > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-stone-600 dark:text-stone-300">
                  {log.missions!.map((mission) => (
                    <li key={mission}>{mission}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                {log.technologies?.map((tech) => (
                  <span
                    key={`t-${tech}`}
                    className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300"
                  >
                    {tech}
                  </span>
                ))}
                {log.skills?.map((skill) => (
                  <span
                    key={`s-${skill}`}
                    className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
          {mode === "structure" && (
            <div className="mt-5">
              <StructurePanel log={log} onDone={() => setMode("view")} onChanged={onChanged} />
            </div>
          )}
          <SkillLinker log={log} skills={skills} onSkillsChanged={onSkillsChanged} />
        </>
      )}
    </article>
  );
}
