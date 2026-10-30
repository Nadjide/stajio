import { useState } from "react";
import { motion } from "motion/react";
import { Loader2, Save } from "lucide-react";
import { api } from "../../services/api";
import { DRAFT_STATUS_LABELS, useDraft } from "../../hooks/useDraft";
import type { UserProfile } from "../../types/models";
import { formatLocalDate, isCalendarDate } from "../../utils/internship";
import { inputClass } from "./noteFields";
import { needsPeriodConfirmation, PeriodWarning } from "./PeriodWarning";

type NoteDraft = { date: string; text: string };
const isNoteEmpty = (draft: NoteDraft) => !draft.text.trim();

/** Saves the raw note only; structuring with the AI is a separate, optional step. */
export function NoteComposer({
  profile,
  onSaved,
  onCancel,
}: {
  profile: UserProfile;
  onSaved: (id: string) => Promise<void>;
  onCancel: () => void;
}) {
  const draft = useDraft<NoteDraft>("journal:new", { date: formatLocalDate(), text: "" }, isNoteEmpty);
  const [confirmedDate, setConfirmedDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { date, text } = draft.value;
  const needsConfirmation = needsPeriodConfirmation(date, profile) && confirmedDate !== date;
  const canSave = !saving && !!text.trim() && isCalendarDate(date) && !needsConfirmation;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      const { id } = await api.logs.add({ date, rawContent: text.trim() });
      await draft.clear();
      await onSaved(id);
    } catch (cause) {
      // The text stays in the form and in the draft.
      setError(cause instanceof Error ? cause.message : "La note n'a pas pu être enregistrée.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.section
      aria-labelledby="new-note-title"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="new-note-title" className="font-bold text-stone-900 dark:text-white">
          Nouvelle note
        </h3>
        <p className="text-xs text-stone-400 dark:text-stone-500" aria-live="polite">
          {DRAFT_STATUS_LABELS[draft.status]}
        </p>
      </div>
      {draft.restored && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
          Ton brouillon non enregistré a été restauré.
        </p>
      )}
      <div className="space-y-1">
        <label htmlFor="new-note-date" className="text-xs font-semibold text-stone-500 dark:text-stone-400">
          Date de l'activité
        </label>
        <input
          id="new-note-date"
          type="date"
          className={`${inputClass} md:w-56`}
          value={date}
          onChange={(event) => draft.setValue((previous) => ({ ...previous, date: event.target.value }))}
        />
      </div>
      <PeriodWarning
        id="new-note-confirm-date"
        date={date}
        profile={profile}
        confirmed={confirmedDate === date}
        onConfirm={(checked) => setConfirmedDate(checked ? date : "")}
      />
      <div className="space-y-1">
        <label htmlFor="new-note-text" className="text-xs font-semibold text-stone-500 dark:text-stone-400">
          Ce que tu as fait
        </label>
        <textarea
          id="new-note-text"
          className={`${inputClass} h-36 resize-y`}
          placeholder="Missions, outils, problèmes rencontrés, ce que tu as appris…"
          value={text}
          onChange={(event) => draft.setValue((previous) => ({ ...previous, text: event.target.value }))}
        />
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error} Ton texte est conservé.
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-6 py-2 text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800"
        >
          Fermer
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-2 font-medium text-white transition-all hover:bg-stone-800 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-700"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Save className="h-5 w-5" aria-hidden />}
          Enregistrer la note
        </button>
      </div>
      <p className="text-xs text-stone-400 dark:text-stone-500">
        L'IA n'est pas nécessaire pour enregistrer. Tu pourras ensuite structurer la note avec l'IA ; ton texte
        d'origine sera conservé.
      </p>
    </motion.section>
  );
}
