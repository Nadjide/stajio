import { useState } from "react";
import { motion } from "motion/react";
import { api } from "../../services/api";
import type { User, UserProfile } from "../../types/models";

export function ProfileTab({ profile, user, onUpdate }: { profile: UserProfile; user: User; onUpdate: (p: UserProfile) => void }) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState(profile);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.profile.update(formData);
      onUpdate(formData);
      setEditing(false);
    } catch (error) {
      console.error("Error saving profile:", error);
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
    </motion.div>
  );
}
