import { BookOpen, Calendar, ChevronDown, Sparkles } from "lucide-react";
import { motion } from "motion/react";

export function TutorialTab() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl">
      <h2 className="mb-8 text-3xl font-bold text-stone-900 dark:text-white">Comment ça marche ?</h2>
      <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <BookOpen className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-stone-900 dark:text-white">1. Journal de bord</h3>
          <p className="text-stone-500 dark:text-stone-400">
            Note tes activités en langage naturel, à la date de ton choix. Si tu le souhaites, l'IA propose ensuite un
            résumé, tes missions, tes compétences et les technologies citées ; ton texte d'origine est conservé.
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <Calendar className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-stone-900 dark:text-white">2. Compétences et échéances</h3>
          <p className="text-stone-500 dark:text-stone-400">
            Relie tes compétences à des notes qui servent de preuves, et garde un œil sur tes échéances école et
            entreprise (exportables dans ton calendrier).
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <Sparkles className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-stone-900 dark:text-white">3. Outils IA</h3>
          <p className="text-stone-500 dark:text-stone-400">
            Prépare ton rapport section par section, entraîne-toi à la soutenance et rédige des points CV : l'IA
            propose, tu relis et tu valides.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <h3 className="mb-6 text-2xl font-bold text-stone-900 dark:text-white">Exemple d'utilisation</h3>
        <div className="space-y-6">
          <div className="rounded-2xl border border-stone-100 bg-stone-50 p-6 dark:border-stone-800 dark:bg-stone-950">
            <p className="mb-2 text-sm font-medium text-stone-500 dark:text-stone-400">Ce que tu écris :</p>
            <p className="text-stone-900 italic dark:text-white">
              "Aujourd'hui j'ai bossé sur l'API de paiement. J'ai utilisé Node.js et Stripe. J'ai eu un bug avec les
              webhooks mais j'ai fini par comprendre qu'il manquait la signature dans le header."
            </p>
          </div>
          <div className="flex justify-center">
            <ChevronDown className="h-6 w-6 text-stone-400" />
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 dark:border-emerald-900/30 dark:bg-emerald-900/10">
            <p className="mb-2 text-sm font-medium text-emerald-600 dark:text-emerald-500">
              Ce que l'IA propose (à relire) :
            </p>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-stone-900 dark:text-white">Résumé</h4>
                <p className="text-stone-700 dark:text-stone-300">
                  Intégration de l'API de paiement Stripe et résolution de problèmes liés aux webhooks.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-stone-900 dark:text-white">Compétences acquises</h4>
                <div className="mt-1 flex gap-2">
                  <span className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs dark:border-stone-700 dark:bg-stone-800">
                    Résolution de bugs
                  </span>
                  <span className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs dark:border-stone-700 dark:bg-stone-800">
                    Intégration API tierce
                  </span>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-stone-900 dark:text-white">Technologies</h4>
                <div className="mt-1 flex gap-2">
                  <span className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs dark:border-stone-700 dark:bg-stone-800">
                    Node.js
                  </span>
                  <span className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs dark:border-stone-700 dark:bg-stone-800">
                    Stripe
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
