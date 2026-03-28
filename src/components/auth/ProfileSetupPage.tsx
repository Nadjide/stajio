import React, { useState } from "react";
import { motion } from "motion/react";
import { format } from "date-fns";
import { api } from "../../services/api";
import type { User, UserProfile } from "../../types/models";

export function ProfileSetupPage({ user, onComplete }: { user: User; onComplete: () => void }) {
  const [profile, setProfile] = useState<Partial<UserProfile>>({
    uid: user.uid,
    displayName: user.displayName || "",
    email: user.email || "",
    school: "",
    degree: "",
    internshipStart: "",
    internshipEnd: "",
    company: "",
    tutorName: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.profile.update(profile);

      const initialDeadlines = [
        {
          title: "Rapport de stage - Version 1",
          date: profile.internshipEnd ? format(new Date(profile.internshipEnd), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
          type: "school",
          completed: false,
        },
        {
          title: "Soutenance finale",
          date: profile.internshipEnd ? format(new Date(profile.internshipEnd), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
          type: "school",
          completed: false,
        },
        {
          title: "Évaluation mi-parcours",
          date: format(new Date(), "yyyy-MM-dd"),
          type: "company",
          completed: false,
        },
      ];

      for (const d of initialDeadlines) {
        await api.deadlines.add({ ...d, uid: user.uid });
      }

      onComplete();
    } catch (error) {
      console.error("Profile Setup Error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 py-12 px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-2xl mx-auto bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm"
      >
        <h2 className="text-2xl font-bold text-stone-900 dark:text-white mb-6">Configure ton profil</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700 dark:text-stone-300">École</label>
            <input
              required
              className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              value={profile.school}
              onChange={(e) => setProfile({ ...profile, school: e.target.value })}
              placeholder="Ex: Ynov, Epitech..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700 dark:text-stone-300">Diplôme</label>
            <input
              required
              className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              value={profile.degree}
              onChange={(e) => setProfile({ ...profile, degree: e.target.value })}
              placeholder="Ex: Master Expert Informatique"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700 dark:text-stone-300">Entreprise</label>
            <input
              required
              className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              value={profile.company}
              onChange={(e) => setProfile({ ...profile, company: e.target.value })}
              placeholder="Ex: Google, Startup..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700 dark:text-stone-300">Tuteur entreprise</label>
            <input
              required
              className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              value={profile.tutorName}
              onChange={(e) => setProfile({ ...profile, tutorName: e.target.value })}
              placeholder="Nom du tuteur"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700 dark:text-stone-300">Début du stage</label>
            <input
              required
              type="date"
              className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              value={profile.internshipStart}
              onChange={(e) => setProfile({ ...profile, internshipStart: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700 dark:text-stone-300">Fin du stage</label>
            <input
              required
              type="date"
              className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              value={profile.internshipEnd}
              onChange={(e) => setProfile({ ...profile, internshipEnd: e.target.value })}
            />
          </div>
          <div className="md:col-span-2 pt-4">
            <button
              type="submit"
              className="w-full bg-emerald-600 dark:bg-emerald-500 text-white py-4 rounded-2xl font-medium hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-all"
            >
              C'est parti !
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
