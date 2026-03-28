import { HelpCircle } from "lucide-react";
import { motion } from "motion/react";

const faqs = [
  {
    q: "Comment mes données sont-elles utilisées ?",
    a: "Tes données sont stockées de manière sécurisée sur Firebase. Elles ne sont utilisées que pour générer tes propres rapports et résumés via l'API Gemini. Personne d'autre n'y a accès.",
  },
  {
    q: "Puis-je exporter mon journal de bord ?",
    a: "Oui, tu peux générer un rapport complet depuis l'onglet 'Outils IA' et l'exporter au format PDF en un clic.",
  },
  {
    q: "L'IA peut-elle écrire tout mon rapport à ma place ?",
    a: "L'IA génère un excellent brouillon structuré basé sur tes notes réelles. Il est fortement recommandé de le relire, de l'enrichir avec ton style personnel et d'ajouter des captures d'écran avant de le rendre.",
  },
  {
    q: "Est-ce que je peux modifier une entrée du journal ?",
    a: "Pour l'instant, tu peux supprimer une entrée et la recréer. La modification directe arrivera dans une prochaine mise à jour !",
  },
];

export function FAQTab() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
      <h2 className="text-3xl font-bold text-stone-900 dark:text-white mb-8">Foire Aux Questions</h2>
      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <div key={i} className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
            <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2 flex items-start gap-3">
              <HelpCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-500 shrink-0" />
              {faq.q}
            </h3>
            <p className="text-stone-600 dark:text-stone-400 ml-9">{faq.a}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
