import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarPlus, CheckCircle2, Circle, Pencil, Trash2 } from "lucide-react";
import { api } from "../../services/api";
import { useToast } from "../ui/Toast";
import { getUrgency, sortDeadlines, TYPE_LABELS, URGENCY_STYLES } from "../../utils/deadlines";
import type { Deadline } from "../../types/models";

type Props = {
  deadlines: Deadline[];
  onRefresh: () => void;
};

type FormState = { title: string; date: string; type: "school" | "company" };

const EMPTY_FORM: FormState = { title: "", date: "", type: "school" };

export function DeadlinesTab({ deadlines, onRefresh }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

  const sorted = useMemo(() => sortDeadlines(deadlines), [deadlines]);

  const addDeadline = async () => {
    if (!form.title.trim() || !form.date) return;
    try {
      await api.deadlines.add({ ...form, completed: false });
      setForm(EMPTY_FORM);
      onRefresh();
      toast("Échéance ajoutée.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erreur lors de l'ajout.", "error");
    }
  };

  const toggleDeadline = async (deadline: Deadline) => {
    try {
      await api.deadlines.update(deadline.id, { completed: !deadline.completed });
      onRefresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erreur lors de la mise à jour.", "error");
    }
  };

  const startEdit = (deadline: Deadline) => {
    setEditingId(deadline.id);
    setEditForm({ title: deadline.title, date: deadline.date, type: deadline.type });
  };

  const saveEdit = async (id: string) => {
    if (!editForm.title.trim() || !editForm.date) return;
    try {
      await api.deadlines.update(id, editForm);
      setEditingId(null);
      onRefresh();
      toast("Échéance mise à jour.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erreur lors de la mise à jour.", "error");
    }
  };

  const deleteDeadline = async (id: string) => {
    if (!window.confirm("Supprimer cette échéance ?")) return;
    try {
      await api.deadlines.delete(id);
      onRefresh();
      toast("Échéance supprimée.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erreur lors de la suppression.", "error");
    }
  };

  const inputClass =
    "p-3 rounded-xl border border-stone-100 dark:border-stone-800 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none";

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-2xl"
    >
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900 dark:text-white">Échéances</h2>
          <p className="text-stone-500 dark:text-stone-400">
            Rendus d'école et jalons d'entreprise. Stajio ne t'envoie pas de notification quand l'application est fermée
            : importe-les dans ton calendrier.
          </p>
        </div>
        <a
          href={api.deadlines.calendarUrl}
          download
          className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:border-emerald-300 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden /> Exporter vers mon calendrier (.ics)
        </a>
      </div>

      <div className="mb-8 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-6 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex flex-col gap-4 md:flex-row">
          <label htmlFor="deadline-title" className="sr-only">
            Titre de l'échéance
          </label>
          <input
            id="deadline-title"
            className={`flex-1 ${inputClass}`}
            placeholder="Titre de l'échéance"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <div className="flex gap-4">
            <label htmlFor="deadline-date" className="sr-only">
              Date de l'échéance
            </label>
            <input
              id="deadline-date"
              type="date"
              className={`flex-1 ${inputClass}`}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <label htmlFor="deadline-type" className="sr-only">
              Type d'échéance
            </label>
            <select
              id="deadline-type"
              className={inputClass}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as "school" | "company" })}
            >
              <option value="school" className="dark:bg-stone-900">
                École
              </option>
              <option value="company" className="dark:bg-stone-900">
                Entreprise
              </option>
            </select>
          </div>
          <button
            onClick={addDeadline}
            disabled={!form.title.trim() || !form.date}
            className="rounded-xl bg-stone-900 px-6 py-3 font-medium text-white transition-all hover:bg-stone-800 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-700"
          >
            Ajouter
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {sorted.length === 0 && (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center dark:border-stone-700 dark:bg-stone-900">
            <p className="text-stone-500 dark:text-stone-400">
              Aucune échéance. Ajoute tes rendus d'école et jalons d'entreprise pour ne rien oublier.
            </p>
          </div>
        )}

        {sorted.map((deadline) => {
          const urgency = getUrgency(deadline);
          const isEditing = editingId === deadline.id;

          if (isEditing) {
            return (
              <div
                key={deadline.id}
                className="space-y-4 rounded-2xl border border-emerald-300 bg-white p-6 shadow-sm dark:border-emerald-700 dark:bg-stone-900"
              >
                <div className="flex flex-col gap-4 md:flex-row">
                  <input
                    aria-label="Titre de l'échéance"
                    className={`flex-1 ${inputClass}`}
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  />
                  <input
                    aria-label="Date de l'échéance"
                    type="date"
                    className={inputClass}
                    value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  />
                  <select
                    aria-label="Type d'échéance"
                    className={inputClass}
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value as "school" | "company" })}
                  >
                    <option value="school" className="dark:bg-stone-900">
                      École
                    </option>
                    <option value="company" className="dark:bg-stone-900">
                      Entreprise
                    </option>
                  </select>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-xl px-4 py-2 text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => saveEdit(deadline.id)}
                    className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={deadline.id}
              className={`group flex items-center gap-4 rounded-2xl border p-6 transition-all ${
                deadline.completed
                  ? "border-stone-100 bg-stone-50 opacity-60 dark:border-stone-800 dark:bg-stone-800/50"
                  : "border-stone-200 bg-white shadow-sm hover:border-emerald-200 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-emerald-700"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleDeadline(deadline)}
                className="shrink-0"
                title="Basculer terminé"
                aria-pressed={deadline.completed}
                aria-label={
                  deadline.completed
                    ? `Marquer « ${deadline.title} » comme à faire`
                    : `Marquer « ${deadline.title} » comme terminée`
                }
              >
                {deadline.completed ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                ) : (
                  <Circle className="h-6 w-6 text-stone-300 dark:text-stone-600" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <h4
                  className={`truncate font-semibold ${
                    deadline.completed
                      ? "text-stone-400 line-through dark:text-stone-500"
                      : "text-stone-900 dark:text-white"
                  }`}
                >
                  {deadline.title}
                </h4>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {format(parseISO(deadline.date), "dd MMMM yyyy", { locale: fr })}
                </p>
              </div>
              {!deadline.completed && (
                <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold ${URGENCY_STYLES[urgency.tone]}`}>
                  {urgency.label}
                </span>
              )}
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold tracking-wider uppercase ${
                  deadline.type === "school"
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    : "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                }`}
              >
                {TYPE_LABELS[deadline.type]}
              </span>
              <div className="flex shrink-0 items-center gap-2 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => startEdit(deadline)}
                  aria-label={`Modifier « ${deadline.title} »`}
                  className="text-stone-300 hover:text-emerald-500 dark:text-stone-600 dark:hover:text-emerald-400"
                  title="Modifier"
                >
                  <Pencil className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteDeadline(deadline.id)}
                  aria-label={`Supprimer « ${deadline.title} »`}
                  className="text-stone-300 hover:text-red-500 dark:text-stone-600 dark:hover:text-red-400"
                  title="Supprimer"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
