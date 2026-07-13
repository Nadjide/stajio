import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, Circle, Pencil, Trash2 } from "lucide-react";
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
      toast("Deadline ajoutée.", "success");
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
      toast("Deadline mise à jour.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erreur lors de la mise à jour.", "error");
    }
  };

  const deleteDeadline = async (id: string) => {
    if (!window.confirm("Supprimer cette deadline ?")) return;
    try {
      await api.deadlines.delete(id);
      onRefresh();
      toast("Deadline supprimée.", "success");
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
      <h2 className="text-3xl font-bold text-stone-900 dark:text-white mb-8">Deadlines</h2>

      <div className="bg-white dark:bg-stone-900 p-4 md:p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            className={`flex-1 ${inputClass}`}
            placeholder="Titre de la deadline"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <div className="flex gap-4">
            <input
              type="date"
              className={`flex-1 ${inputClass}`}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <select
              className={inputClass}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as "school" | "company" })}
            >
              <option value="school" className="dark:bg-stone-900">École</option>
              <option value="company" className="dark:bg-stone-900">Entreprise</option>
            </select>
          </div>
          <button
            onClick={addDeadline}
            disabled={!form.title.trim() || !form.date}
            className="bg-stone-900 dark:bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-stone-800 dark:hover:bg-emerald-700 transition-all disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {sorted.length === 0 && (
          <div className="bg-white dark:bg-stone-900 p-12 rounded-3xl border border-dashed border-stone-300 dark:border-stone-700 text-center">
            <p className="text-stone-500 dark:text-stone-400">
              Aucune deadline. Ajoute tes rendus d'école et jalons d'entreprise pour ne rien oublier.
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
                className="p-6 rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-stone-900 shadow-sm space-y-4"
              >
                <div className="flex flex-col md:flex-row gap-4">
                  <input
                    className={`flex-1 ${inputClass}`}
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  />
                  <input
                    type="date"
                    className={inputClass}
                    value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  />
                  <select
                    className={inputClass}
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value as "school" | "company" })}
                  >
                    <option value="school" className="dark:bg-stone-900">École</option>
                    <option value="company" className="dark:bg-stone-900">Entreprise</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-4 py-2 rounded-xl text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => saveEdit(deadline.id)}
                    className="bg-emerald-600 dark:bg-emerald-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 dark:hover:bg-emerald-600"
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
              className={`p-6 rounded-2xl border transition-all flex items-center gap-4 group ${
                deadline.completed
                  ? "bg-stone-50 dark:bg-stone-800/50 border-stone-100 dark:border-stone-800 opacity-60"
                  : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 shadow-sm hover:border-emerald-200 dark:hover:border-emerald-700"
              }`}
            >
              <button onClick={() => toggleDeadline(deadline)} className="shrink-0" title="Basculer terminé">
                {deadline.completed ? (
                  <CheckCircle2 className="text-emerald-500 w-6 h-6" />
                ) : (
                  <Circle className="text-stone-300 dark:text-stone-600 w-6 h-6" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <h4
                  className={`font-semibold truncate ${
                    deadline.completed
                      ? "text-stone-400 dark:text-stone-500 line-through"
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
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${URGENCY_STYLES[urgency.tone]}`}>
                  {urgency.label}
                </span>
              )}
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                  deadline.type === "school"
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    : "bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                }`}
              >
                {TYPE_LABELS[deadline.type]}
              </span>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => startEdit(deadline)}
                  className="text-stone-300 dark:text-stone-600 hover:text-emerald-500 dark:hover:text-emerald-400"
                  title="Modifier"
                >
                  <Pencil className="w-5 h-5" />
                </button>
                <button
                  onClick={() => deleteDeadline(deadline.id)}
                  className="text-stone-300 dark:text-stone-600 hover:text-red-500 dark:hover:text-red-400"
                  title="Supprimer"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
