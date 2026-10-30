import { HelpCircle } from "lucide-react";
import { motion } from "motion/react";

const faqs = [
  {
    q: "Comment mes données sont-elles utilisées ?",
    a: "Tes données sont stockées en local dans la base SQLite de Stajio, séparément pour chaque compte. Les traitements IA passent par ton modèle local via Ollama (par défaut phi4-mini). Aucune clé API cloud n'est requise.",
  },
  {
    q: "Ai-je besoin de l'IA pour utiliser Stajio ?",
    a: "Non. Le journal, les compétences, les échéances et la rédaction du rapport fonctionnent sans Ollama. L'IA propose ensuite des structurations, des plans ou des formulations que tu relis avant de les appliquer.",
  },
  {
    q: "L'IA peut-elle inventer des informations ?",
    a: "Les consignes lui interdisent d'inventer des chiffres ou des réalisations : elle signale ce qui manque par « [À compléter : … ] ». Ces passages sont surlignés et comptés avant l'export. Relis toujours le texte : la note d'une simulation de soutenance reste une aide à l'entraînement.",
  },
  {
    q: "Mes brouillons sont-ils conservés ?",
    a: "Oui. Une note ou une configuration en cours est enregistrée automatiquement avec ton compte. Elle est proposée à ta prochaine connexion, n'apparaît jamais dans un autre compte et fait partie de la sauvegarde.",
  },
  {
    q: "Comment retrouver une ancienne version de mon rapport ?",
    a: "Dans « Rapport », étape « Relecture et export », enregistre des versions nommées et restaure-les. Stajio enregistre aussi une version avant chaque régénération d'une section et avant chaque restauration.",
  },
  {
    q: "Puis-je exporter mes données ?",
    a: "Oui : le rapport en PDF ou Markdown, les points CV en texte ou Markdown, les échéances au format calendrier (.ics) et l'intégralité du compte en JSON depuis ton profil. Le fichier JSON permet de tout restaurer.",
  },
  {
    q: "Que se passe-t-il si Ollama n'est pas lancé ?",
    a: "Le diagnostic de ton profil l'indique et donne la commande à lancer. Une génération en échec ou annulée ne modifie ni tes notes ni tes corrections.",
  },
];

export function FAQTab() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
      <h2 className="mb-8 text-3xl font-bold text-stone-900 dark:text-white">Foire Aux Questions</h2>
      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <div
            key={i}
            className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900"
          >
            <h3 className="mb-2 flex items-start gap-3 text-lg font-bold text-stone-900 dark:text-white">
              <HelpCircle className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-500" />
              {faq.q}
            </h3>
            <p className="ml-9 text-stone-600 dark:text-stone-400">{faq.a}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
