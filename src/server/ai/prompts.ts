type Payload = Record<string, unknown>;

export function structureLogPrompt(payload: Payload) {
  return `Structure cette entrée de journal d'alternance. Réponds uniquement en JSON valide avec ce schéma exact: {"summary":string,"missions":string[],"technologies":string[],"skills":string[]}. Entrée: ${String(payload?.rawContent || "")}`;
}

export function generateReportPrompt(payload: Payload) {
  return `Génère un rapport de stage structuré en français, format Markdown. Contexte étudiant: ${JSON.stringify(payload?.userData || {})}. Logs: ${JSON.stringify(payload?.logs || [])}. Inclure: Introduction, Présentation de l'entreprise, Missions réalisées, Bilan technique, Conclusion.`;
}

export function prepareDefensePrompt(payload: Payload) {
  return `Prépare une soutenance en français. Réponds uniquement en JSON valide avec ce schéma exact: {"plan":string[],"questions":[{"question":string,"answerHint":string}]}. Contexte étudiant: ${JSON.stringify(payload?.userData || {})}. Expérience: ${JSON.stringify(payload?.logs || [])}.`;
}

export function generateCVPointsPrompt(payload: Payload) {
  return `Transforme ces expériences d'alternance en bullet points optimisés ATS, en français. Utilise des verbes d'action et quantifie les résultats si possible. Données: ${JSON.stringify(payload?.logs || [])}`;
}

export function chatSystemPrompt(payload: Payload) {
  return `Tu es l'assistant personnel de Stajio, une application de suivi d'alternance/stage. Tu aides l'étudiant à réfléchir sur son parcours, formuler ses bilans, préparer sa soutenance et valoriser son expérience. Réponds en français, de manière concise et concrète. Voici son profil: ${JSON.stringify(payload?.userData || {})}. Voici son journal de bord complet: ${JSON.stringify(payload?.logs || [])}.`;
}

export function evaluateAnswerPrompt(payload: Payload) {
  return `Tu es un membre de jury de soutenance d'alternance bienveillant mais exigeant. Question posée: "${String(payload?.question || "")}". Réponse de l'étudiant: "${String(payload?.answer || "")}". Contexte étudiant: ${JSON.stringify(payload?.userData || {})}. Évalue la réponse en français. Réponds uniquement en JSON valide avec ce schéma exact: {"score":number,"feedback":string,"improvedAnswer":string} où score est une note sur 10, feedback un retour constructif de 2-3 phrases, et improvedAnswer une meilleure formulation possible de la réponse.`;
}

export type ChatHistoryMessage = { role: "user" | "assistant"; content: string };

export function sanitizeChatHistory(payload: Payload): ChatHistoryMessage[] {
  const history = Array.isArray(payload?.history) ? payload.history : [];
  return history
    .filter(
      (m): m is ChatHistoryMessage =>
        !!m &&
        typeof m === "object" &&
        (("role" in m && (m as ChatHistoryMessage).role === "user") || (m as ChatHistoryMessage).role === "assistant") &&
        typeof (m as ChatHistoryMessage).content === "string",
    )
    .slice(-20);
}
