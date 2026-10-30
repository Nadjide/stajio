import type { ReportBrief, ReportSection, SourceSnapshot } from "../../types/models";
import { DEFENSE_CRITERIA } from "../../utils/defense";
import { formatProfile, formatSources, type ProfileContext } from "./context";

/** Version of the instructions below; stored with each generation. */
export const PROMPT_VERSION = "v1-2026-10";

const GROUNDING_RULES = `Règles impératives :
- Utilise uniquement les informations du profil et des notes de journal fournies.
- N'invente aucun chiffre, résultat, nom d'outil, de personne ou d'entreprise, réalisation ou retour de tuteur absent des notes.
- Lorsqu'une information utile manque, écris à la place : [À compléter : information attendue].
- Écris en français, de façon factuelle et sobre, à la première personne quand tu rédiges pour l'étudiant.`;

function dataBlock(profile: ProfileContext, sources: SourceSnapshot[]) {
  return `PROFIL\n${formatProfile(profile)}\n\nNOTES DU JOURNAL\n${formatSources(sources)}`;
}

export function structureLogPrompt(rawContent: string) {
  return `Structure cette note de journal de stage ou d'alternance.
${GROUNDING_RULES}
- "summary" : 1 à 3 phrases reformulant fidèlement la note.
- "missions" : les tâches réalisées, formulées brièvement.
- "technologies" : les outils, langages ou logiciels cités explicitement.
- "skills" : les compétences mobilisées (savoir-faire), en libellés courts.
Laisse une liste vide si la note ne contient pas l'information.
Réponds uniquement en JSON valide avec ce schéma exact : {"summary":string,"missions":string[],"technologies":string[],"skills":string[]}.

NOTE
${rawContent}`;
}

export function defensePrepPrompt(profile: ProfileContext, sources: SourceSnapshot[]) {
  return `Prépare une soutenance de stage ou d'alternance.
${GROUNDING_RULES}
Propose un plan de présentation (5 à 8 parties) et 5 à 8 questions probables du jury, chacune avec un conseil de réponse appuyé sur les notes.
Réponds uniquement en JSON valide avec ce schéma exact : {"plan":string[],"questions":[{"question":string,"answerHint":string}]}.

${dataBlock(profile, sources)}`;
}

export function evaluateAnswerPrompt(profile: ProfileContext, question: string, answer: string) {
  const criteria = DEFENSE_CRITERIA.map((criterion) => `- ${criterion.label} : ${criterion.description}`).join("\n");
  return `Tu es membre d'un jury de soutenance, bienveillant mais exigeant. Évalue la réponse de l'étudiant pour l'aider à s'entraîner.
Critères d'évaluation :
${criteria}
Donne une note indicative de 0 à 10 (nombre), un retour constructif de 2 à 4 phrases qui cite les critères concernés, et une meilleure formulation qui reste fidèle aux faits donnés par l'étudiant ; n'y ajoute aucun chiffre ni résultat inventé, utilise [À compléter : …] si un exemple manque.
Réponds uniquement en JSON valide avec ce schéma exact : {"score":number,"feedback":string,"improvedAnswer":string}.

PROFIL
${formatProfile(profile)}

QUESTION
${question}

RÉPONSE DE L'ÉTUDIANT
${answer}`;
}

function briefBlock(brief: ReportBrief) {
  return [
    `Consignes de l'école : ${brief.guidelines.trim() || "[aucune consigne fournie]"}`,
    `Problématique : ${brief.problem.trim() || "[non définie]"}`,
    `Longueur indicative : ${brief.targetLength.trim() || "[non précisée]"}`,
    `Période couverte : du ${brief.periodStart || "?"} au ${brief.periodEnd || "?"}`,
  ].join("\n");
}

export function reportPlanPrompt(profile: ProfileContext, brief: ReportBrief, sources: SourceSnapshot[]) {
  return `Propose le plan d'un rapport de stage ou d'alternance qui respecte les consignes de l'école.
${GROUNDING_RULES}
Donne 4 à 10 sections. Pour chacune : un titre et une intention (ce que la section doit démontrer, en une phrase).
Réponds uniquement en JSON valide avec ce schéma exact : {"sections":[{"title":string,"intent":string}]}.

BRIEF
${briefBlock(brief)}

${dataBlock(profile, sources)}`;
}

export function reportSectionPrompt(
  profile: ProfileContext,
  brief: ReportBrief,
  sections: ReportSection[],
  section: ReportSection,
  sources: SourceSnapshot[],
) {
  const plan = sections.map((item, index) => `${index + 1}. ${item.title}${item.intent ? ` — ${item.intent}` : ""}`);
  return `Rédige uniquement la section « ${section.title} » d'un rapport de stage ou d'alternance.
${GROUNDING_RULES}
- Intention de la section : ${section.intent.trim() || "[non précisée]"}.
- Format Markdown. Ne répète pas le titre de la section ; utilise des sous-titres ### si nécessaire, des paragraphes et des listes.
- Ne rédige pas les autres sections du plan.

BRIEF
${briefBlock(brief)}

PLAN COMPLET
${plan.join("\n")}

${dataBlock(profile, sources)}`;
}

export function cvPointsPrompt(profile: ProfileContext, sources: SourceSnapshot[]) {
  return `Transforme ces expériences de stage ou d'alternance en 4 à 8 points de CV, en français, optimisés pour les logiciels de recrutement (ATS).
${GROUNDING_RULES}
- Une liste Markdown, un point par ligne, commençant par un verbe d'action.
- Ne quantifie que si le chiffre figure dans les notes ; sinon ajoute [À compléter : chiffre ou résultat mesurable] pour inviter l'étudiant à le préciser.

${dataBlock(profile, sources)}`;
}

export function chatSystemPrompt(profile: ProfileContext, sources: SourceSnapshot[]) {
  return `Tu es l'assistant de Stajio, une application de suivi de stage et d'alternance. Tu aides l'étudiant à réfléchir à son parcours, formuler ses bilans, préparer sa soutenance et valoriser son expérience. Réponds de manière concise et concrète.
${GROUNDING_RULES}
Si la question porte sur un fait absent des notes, dis-le et demande la précision à l'étudiant.

${dataBlock(profile, sources)}`;
}
