import { useState } from "react";
import { motion } from "motion/react";
import { format, differenceInWeeks, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2, Pencil, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { api } from "../../services/api";
import { structureLog } from "../../services/ai";
import { useToast } from "../ui/Toast";
import type { LogEntry, UserProfile } from "../../types/models";

type Props = {
  profile: UserProfile;
  logs: LogEntry[];
  onRefresh: () => void;
};

export function JournalTab({ profile, logs, onRefresh }: Props) {
  const { toast } = useToast();
  const [isLogging, setIsLogging] = useState(false);
  const [newLog, setNewLog] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const handleAddLog = async () => {
    if (!newLog.trim()) return;
    setLoadingAI(true);
    try {
      const structured = await structureLog(newLog);
      const weekNumber = differenceInWeeks(new Date(), parseISO(profile.internshipStart)) + 1;

      await api.logs.add({
        date: format(new Date(), "yyyy-MM-dd"),
        rawContent: newLog,
        structuredContent: structured.summary,
        summary: structured.summary,
        missions: structured.missions,
        technologies: structured.technologies,
        skills: structured.skills,
        weekNumber,
      });

      setNewLog("");
      setIsLogging(false);
      onRefresh();
      toast("Entrée ajoutée et structurée par l'IA.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erreur lors de l'ajout de l'entrée.", "error");
    } finally {
      setLoadingAI(false);
    }
  };

  const startEdit = (log: LogEntry) => {
    setEditingId(log.id);
    setEditContent(log.rawContent || log.summary || "");
  };

  const saveEdit = async (log: LogEntry, restructure: boolean) => {
    if (!editContent.trim()) return;
    setSavingEdit(true);
    try {
      if (restructure) {
        const structured = await structureLog(editContent);
        await api.logs.update(log.id, {
          rawContent: editContent,
          structuredContent: structured.summary,
          summary: structured.summary,
          missions: structured.missions,
          technologies: structured.technologies,
          skills: structured.skills,
        });
        toast("Entrée mise à jour et re-structurée par l'IA.", "success");
      } else {
        await api.logs.update(log.id, {
          rawContent: editContent,
          summary: editContent,
          structuredContent: editContent,
        });
        toast("Entrée mise à jour.", "success");
      }
      setEditingId(null);
      onRefresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erreur lors de la mise à jour.", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteLog = async (id: string) => {
    if (!window.confirm("Supprimer cette entrée de journal ?")) return;
    try {
      await api.logs.delete(id);
      onRefresh();
      toast("Entrée supprimée.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erreur lors de la suppression.", "error");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-stone-900 dark:text-white">Journal de bord</h2>
          <p className="text-stone-500 dark:text-stone-400">Documente tes progrès chaque semaine.</p>
        </div>
        <button
          onClick={() => setIsLogging(true)}
          className="bg-emerald-600 dark:bg-emerald-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nouvelle entrée
        </button>
      </div>

      {isLogging && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm mb-8"
        >
          <textarea
            className="w-full h-32 p-4 rounded-xl border border-stone-100 dark:border-stone-800 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none mb-4"
            placeholder="Qu'as-tu fait cette semaine ? (Missions, technos, problèmes...)"
            value={newLog}
            onChange={(e) => setNewLog(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setIsLogging(false)}
              className="px-6 py-2 rounded-xl text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              Annuler
            </button>
            <button
              onClick={handleAddLog}
              disabled={loadingAI || !newLog.trim()}
              className="bg-stone-900 dark:bg-emerald-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-stone-800 dark:hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loadingAI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              Enregistrer avec l'IA
            </button>
          </div>
        </motion.div>
      )}

      <div className="space-y-6">
        {logs.length === 0 && !isLogging && (
          <div className="bg-white dark:bg-stone-900 p-12 rounded-3xl border border-dashed border-stone-300 dark:border-stone-700 text-center">
            <p className="text-stone-500 dark:text-stone-400">
              Aucune entrée pour l'instant. Raconte ta première semaine, l'IA s'occupe de la structurer !
            </p>
          </div>
        )}

        {logs.map((log) => (
          <div
            key={log.id}
            className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm relative group"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Semaine {log.weekNumber}
                </span>
                <h3 className="text-xl font-bold text-stone-900 dark:text-white mt-1">
                  {format(parseISO(log.date), "dd MMMM yyyy", { locale: fr })}
                </h3>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(log)}
                  className="text-stone-300 dark:text-stone-600 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
                  title="Modifier"
                >
                  <Pencil className="w-5 h-5" />
                </button>
                <button
                  onClick={() => deleteLog(log.id)}
                  className="text-stone-300 dark:text-stone-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {editingId === log.id ? (
              <div>
                <textarea
                  className="w-full h-32 p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none mb-4"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-4 py-2 rounded-xl text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => saveEdit(log, false)}
                    disabled={savingEdit || !editContent.trim()}
                    className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-medium hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50"
                  >
                    Enregistrer tel quel
                  </button>
                  <button
                    onClick={() => saveEdit(log, true)}
                    disabled={savingEdit || !editContent.trim()}
                    className="bg-emerald-600 dark:bg-emerald-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Re-structurer avec l'IA
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-stone-600 dark:text-stone-300 mb-6 leading-relaxed">
                  {log.summary || log.structuredContent}
                </p>

                <div className="flex flex-wrap gap-2">
                  {log.technologies?.map((tech, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-lg text-xs font-medium"
                    >
                      {tech}
                    </span>
                  ))}
                  {log.skills?.map((skill, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
