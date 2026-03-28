import { BookOpen, Calendar, ChevronDown, Sparkles } from "lucide-react";
import { motion } from "motion/react";

export function TutorialTab() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl">
      <h2 className="text-3xl font-bold text-stone-900 dark:text-white mb-8">Comment ça marche ?</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mb-4">
            <BookOpen className="text-emerald-600 dark:text-emerald-400 w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-2">1. Journal de bord</h3>
          <p className="text-stone-500 dark:text-stone-400">
            Note tes tâches quotidiennes en langage naturel. L'IA structure tout, extrait tes compétences et les technologies utilisées.
          </p>
        </div>
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mb-4">
            <Calendar className="text-emerald-600 dark:text-emerald-400 w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-2">2. Deadlines</h3>
          <p className="text-stone-500 dark:text-stone-400">Garde un oeil sur tes échéances école (rapports, soutenances) et entreprise (livrables, points d'étape).</p>
        </div>
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mb-4">
            <Sparkles className="text-emerald-600 dark:text-emerald-400 w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-2">3. Outils IA</h3>
          <p className="text-stone-500 dark:text-stone-400">Génère ton rapport de stage, prépare ta soutenance ou optimise ton CV en un clic grâce à l'historique de ton journal.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
        <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-6">Exemple d'utilisation</h3>
        <div className="space-y-6">
          <div className="bg-stone-50 dark:bg-stone-950 p-6 rounded-2xl border border-stone-100 dark:border-stone-800">
            <p className="text-sm font-medium text-stone-500 dark:text-stone-400 mb-2">Ce que tu écris :</p>
            <p className="text-stone-900 dark:text-white italic">
              "Aujourd'hui j'ai bossé sur l'API de paiement. J'ai utilisé Node.js et Stripe. J'ai eu un bug avec les webhooks mais j'ai fini par comprendre qu'il manquait la signature dans le header."
            </p>
          </div>
          <div className="flex justify-center">
            <ChevronDown className="text-stone-400 w-6 h-6" />
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-500 mb-2">Ce que l'IA génère :</p>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-stone-900 dark:text-white">Résumé</h4>
                <p className="text-stone-700 dark:text-stone-300">Intégration de l'API de paiement Stripe et résolution de problèmes liés aux webhooks.</p>
              </div>
              <div>
                <h4 className="font-semibold text-stone-900 dark:text-white">Compétences acquises</h4>
                <div className="flex gap-2 mt-1">
                  <span className="px-2 py-1 bg-white dark:bg-stone-800 rounded-md text-xs border border-stone-200 dark:border-stone-700">Résolution de bugs</span>
                  <span className="px-2 py-1 bg-white dark:bg-stone-800 rounded-md text-xs border border-stone-200 dark:border-stone-700">Intégration API tierce</span>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-stone-900 dark:text-white">Technologies</h4>
                <div className="flex gap-2 mt-1">
                  <span className="px-2 py-1 bg-white dark:bg-stone-800 rounded-md text-xs border border-stone-200 dark:border-stone-700">Node.js</span>
                  <span className="px-2 py-1 bg-white dark:bg-stone-800 rounded-md text-xs border border-stone-200 dark:border-stone-700">Stripe</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
