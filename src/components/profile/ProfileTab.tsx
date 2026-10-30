import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Cpu, RefreshCw, XCircle } from "lucide-react";
import { api } from "../../services/api";
import { getPreferredModel, setPreferredModel } from "../../services/ai";
import { useToast } from "../ui/Toast";
import type { AiStatus, User, UserProfile } from "../../types/models";
import { DataBackupSection } from "./DataBackupSection";
import { AccountSecuritySection } from "./AccountSecuritySection";

function SettingsSection({ onDataImported }: { onDataImported: () => Promise<void> }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [selectedModel, setSelectedModel] = useState(getPreferredModel() || "");

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await api.ai.status());
    } catch {
      setStatus(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    setPreferredModel(value || null);
    toast(value ? `Modèle IA : ${value}` : "Modèle IA par défaut restauré.", "success");
  };

  const effectiveModel = selectedModel || status?.defaultModel || "";
  const installed = (model: string) =>
    !!status?.models.some((name) => name === model || name === `${model}:latest` || name.split(":")[0] === model);
  const modelReady = !!status?.reachable && installed(effectiveModel);
  const options = status ? [...new Set([...status.models, ...(selectedModel ? [selectedModel] : [])])] : [];

  return (
    <div className="mt-6 space-y-8 rounded-3xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <section aria-labelledby="ai-diagnostic">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
            <Cpu className="h-5 w-5 text-purple-600 dark:text-purple-400" aria-hidden />
          </div>
          <div className="flex-1">
            <h3 id="ai-diagnostic" className="font-bold text-stone-900 dark:text-white">
              IA locale (Ollama)
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Facultative : le journal, les échéances et le rapport restent utilisables sans elle.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void check()}
            disabled={checking}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100 disabled:opacity-50 dark:hover:bg-stone-800"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} aria-hidden /> Vérifier
          </button>
        </div>
        <ul className="mb-4 space-y-2 text-sm" aria-live="polite">
          <li className="flex items-center gap-2">
            {status?.reachable ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" aria-hidden />
            )}
            {checking ? "Vérification…" : status?.reachable ? "Ollama est joignable." : "Ollama est injoignable."}
          </li>
          {status?.reachable && (
            <li className="flex items-center gap-2">
              {modelReady ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" aria-hidden />
              )}
              Modèle sélectionné : <strong>{effectiveModel}</strong> {modelReady ? "(installé)" : "(non installé)"}
            </li>
          )}
          {status && (
            <li className="text-xs text-stone-400 dark:text-stone-500">
              Contexte demandé au modèle : {status.contextTokens} jetons, dont {status.inputBudgetTokens} pour les notes
              et consignes.
            </li>
          )}
        </ul>
        {!checking && !status?.reachable && (
          <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            Lance Ollama avec <code className="font-mono">ollama serve</code> (ou démarre le service Docker), puis
            clique sur « Vérifier ».
          </p>
        )}
        {status?.reachable && !modelReady && (
          <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            Installe le modèle avec <code className="font-mono">ollama pull {effectiveModel}</code>, ou choisis un
            modèle installé ci-dessous.
          </p>
        )}
        <label htmlFor="ai-model" className="mb-1 block text-xs font-semibold text-stone-500 dark:text-stone-400">
          Modèle utilisé pour les générations
        </label>
        <select
          id="ai-model"
          className="w-full rounded-xl border border-stone-200 bg-transparent p-3 outline-none focus:ring-2 focus:ring-emerald-500 md:w-80 dark:border-stone-700 dark:text-white"
          value={selectedModel}
          onChange={(e) => handleModelChange(e.target.value)}
        >
          <option value="" className="dark:bg-stone-900">
            Par défaut ({status?.defaultModel || "…"})
          </option>
          {options.map((model) => (
            <option key={model} value={model} className="dark:bg-stone-900">
              {model}
            </option>
          ))}
        </select>
      </section>

      <DataBackupSection onRestored={onDataImported} />
    </div>
  );
}

export function ProfileTab({
  profile,
  user,
  onUpdate,
  onDataImported,
  onAccountDeleted,
}: {
  profile: UserProfile;
  user: User;
  onUpdate: (p: UserProfile) => void;
  onDataImported: () => Promise<void>;
  onAccountDeleted: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState(profile);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.profile.update(formData);
      onUpdate(formData);
      setEditing(false);
      toast("Profil mis à jour.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erreur lors de l'enregistrement.", "error");
    }
    setSaving(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-3xl font-bold text-stone-900 dark:text-white">Mon Profil</h2>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="rounded-xl bg-stone-100 px-4 py-2 font-medium text-stone-700 transition-all hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            Modifier
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => {
                setFormData(profile);
                setEditing(false);
              }}
              className="rounded-xl px-4 py-2 font-medium text-stone-500 transition-all hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white transition-all hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6 rounded-3xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-500 dark:text-stone-400">Nom d'affichage</label>
            <input
              disabled={!editing}
              className="w-full rounded-xl border border-stone-200 bg-transparent p-3 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50 disabled:opacity-70 dark:border-stone-700 dark:text-white dark:disabled:bg-stone-950"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-500 dark:text-stone-400">Email</label>
            <input
              disabled
              className="w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-stone-500 outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-400"
              value={formData.email}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-500 dark:text-stone-400">École</label>
            <input
              disabled={!editing}
              className="w-full rounded-xl border border-stone-200 bg-transparent p-3 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50 disabled:opacity-70 dark:border-stone-700 dark:text-white dark:disabled:bg-stone-950"
              value={formData.school}
              onChange={(e) => setFormData({ ...formData, school: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-500 dark:text-stone-400">Diplôme</label>
            <input
              disabled={!editing}
              className="w-full rounded-xl border border-stone-200 bg-transparent p-3 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50 disabled:opacity-70 dark:border-stone-700 dark:text-white dark:disabled:bg-stone-950"
              value={formData.degree}
              onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-500 dark:text-stone-400">Entreprise</label>
            <input
              disabled={!editing}
              className="w-full rounded-xl border border-stone-200 bg-transparent p-3 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50 disabled:opacity-70 dark:border-stone-700 dark:text-white dark:disabled:bg-stone-950"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-500 dark:text-stone-400">Tuteur entreprise</label>
            <input
              disabled={!editing}
              className="w-full rounded-xl border border-stone-200 bg-transparent p-3 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50 disabled:opacity-70 dark:border-stone-700 dark:text-white dark:disabled:bg-stone-950"
              value={formData.tutorName}
              onChange={(e) => setFormData({ ...formData, tutorName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-500 dark:text-stone-400">Début du stage</label>
            <input
              type="date"
              disabled={!editing}
              className="w-full rounded-xl border border-stone-200 bg-transparent p-3 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50 disabled:opacity-70 dark:border-stone-700 dark:text-white dark:disabled:bg-stone-950"
              value={formData.internshipStart}
              onChange={(e) => setFormData({ ...formData, internshipStart: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-500 dark:text-stone-400">Fin du stage</label>
            <input
              type="date"
              disabled={!editing}
              className="w-full rounded-xl border border-stone-200 bg-transparent p-3 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50 disabled:opacity-70 dark:border-stone-700 dark:text-white dark:disabled:bg-stone-950"
              value={formData.internshipEnd}
              onChange={(e) => setFormData({ ...formData, internshipEnd: e.target.value })}
            />
          </div>
        </div>
      </div>

      <SettingsSection onDataImported={onDataImported} />
      <AccountSecuritySection onDataCleared={onDataImported} onAccountDeleted={onAccountDeleted} />
    </motion.div>
  );
}
