import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Cpu, Download, Upload } from "lucide-react";
import { api } from "../../services/api";
import { getPreferredModel, setPreferredModel } from "../../services/ai";
import { useToast } from "../ui/Toast";
import type { User, UserProfile } from "../../types/models";

function SettingsSection({ onDataImported }: { onDataImported: () => void }) {
  const { toast } = useToast();
  const [models, setModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState("");
  const [selectedModel, setSelectedModel] = useState(getPreferredModel() || "");
  const [modelsError, setModelsError] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.models
      .list()
      .then((data) => {
        setModels(data.models);
        setDefaultModel(data.default);
      })
      .catch(() => setModelsError(true));
  }, []);

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    setPreferredModel(value || null);
    toast(value ? `Modèle IA: ${value}` : "Modèle IA par défaut restauré.", "success");
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await api.data.import(data);
      const { logs = 0, deadlines = 0, aiOutputs = 0 } = result?.imported || {};
      toast(`Import réussi: ${logs} entrées, ${deadlines} deadlines, ${aiOutputs} générations IA.`, "success");
      onDataImported();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Fichier d'import invalide.", "error");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm mt-6 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
            <Cpu className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 dark:text-white">Modèle IA (Ollama)</h3>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Le modèle local utilisé pour toutes les générations.
            </p>
          </div>
        </div>
        {modelsError ? (
          <p className="text-sm text-red-500 dark:text-red-400">
            Ollama injoignable. Lance <code className="font-mono">ollama serve</code> pour choisir un modèle.
          </p>
        ) : (
          <select
            className="w-full md:w-80 p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
          >
            <option value="" className="dark:bg-stone-900">
              Par défaut ({defaultModel || "..."})
            </option>
            {models.map((model) => (
              <option key={model} value={model} className="dark:bg-stone-900">
                {model}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
            <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 dark:text-white">Mes données</h3>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Local-first: tes données t'appartiennent. Sauvegarde-les ou restaure-les en JSON.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={api.data.exportUrl}
            download
            className="flex items-center gap-2 px-5 py-2.5 bg-stone-900 dark:bg-emerald-600 text-white rounded-xl font-medium hover:bg-stone-800 dark:hover:bg-emerald-700 transition-all text-sm"
          >
            <Download className="w-4 h-4" />
            Exporter tout (JSON)
          </a>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-5 py-2.5 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 rounded-xl font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-all text-sm disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {importing ? "Import en cours..." : "Importer un export"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function ProfileTab({
  profile,
  user,
  onUpdate,
  onDataImported,
}: {
  profile: UserProfile;
  user: User;
  onUpdate: (p: UserProfile) => void;
  onDataImported: () => void;
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
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-stone-900 dark:text-white">Mon Profil</h2>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
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
              className="px-4 py-2 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl font-medium transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 dark:bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-all disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-500 dark:text-stone-400">Nom d'affichage</label>
            <input
              disabled={!editing}
              className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-70 disabled:bg-stone-50 dark:disabled:bg-stone-950"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-500 dark:text-stone-400">Email</label>
            <input disabled className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-500 dark:text-stone-400 outline-none" value={formData.email} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-500 dark:text-stone-400">École</label>
            <input
              disabled={!editing}
              className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-70 disabled:bg-stone-50 dark:disabled:bg-stone-950"
              value={formData.school}
              onChange={(e) => setFormData({ ...formData, school: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-500 dark:text-stone-400">Diplôme</label>
            <input
              disabled={!editing}
              className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-70 disabled:bg-stone-50 dark:disabled:bg-stone-950"
              value={formData.degree}
              onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-500 dark:text-stone-400">Entreprise</label>
            <input
              disabled={!editing}
              className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-70 disabled:bg-stone-50 dark:disabled:bg-stone-950"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-500 dark:text-stone-400">Tuteur entreprise</label>
            <input
              disabled={!editing}
              className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-70 disabled:bg-stone-50 dark:disabled:bg-stone-950"
              value={formData.tutorName}
              onChange={(e) => setFormData({ ...formData, tutorName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-500 dark:text-stone-400">Début du stage</label>
            <input
              type="date"
              disabled={!editing}
              className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-70 disabled:bg-stone-50 dark:disabled:bg-stone-950"
              value={formData.internshipStart}
              onChange={(e) => setFormData({ ...formData, internshipStart: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-500 dark:text-stone-400">Fin du stage</label>
            <input
              type="date"
              disabled={!editing}
              className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-70 disabled:bg-stone-50 dark:disabled:bg-stone-950"
              value={formData.internshipEnd}
              onChange={(e) => setFormData({ ...formData, internshipEnd: e.target.value })}
            />
          </div>
        </div>
      </div>

      <SettingsSection onDataImported={onDataImported} />
    </motion.div>
  );
}
