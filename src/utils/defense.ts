/** Shown to the student and given to the model, so the score is explainable. */
export const DEFENSE_CRITERIA = [
  { label: "Pertinence", description: "La réponse traite directement la question posée." },
  { label: "Exemples concrets", description: "Elle s'appuie sur des missions ou situations réelles du stage." },
  { label: "Structure", description: "Elle suit un fil clair : contexte, action, résultat ou apprentissage." },
  { label: "Recul", description: "Elle montre ce que l'étudiant a appris ou ferait autrement." },
  { label: "Clarté", description: "Elle est formulée simplement, dans un temps de parole raisonnable." },
] as const;

export function averageScore(scores: number[]): number | null {
  if (!scores.length) return null;
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
}
