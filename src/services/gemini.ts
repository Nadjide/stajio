const callLocalAi = async <T = any>(task: string, payload: Record<string, unknown>) => {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, payload }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Erreur IA locale");
  }

  return data as T;
};

export const structureLog = async (rawContent: string) => {
  return callLocalAi<{
    summary: string;
    missions: string[];
    technologies: string[];
    skills: string[];
  }>("structureLog", { rawContent });
};

export const generateReport = async (userData: any, logs: any[]) => {
  const response = await callLocalAi<{ content: string }>("generateReport", { userData, logs });
  return response.content;
};

export const prepareDefense = async (userData: any, logs: any[]) => {
  return callLocalAi<{
    plan: string[];
    questions: Array<{ question: string; answerHint: string }>;
  }>("prepareDefense", { userData, logs });
};

export const generateCVPoints = async (logs: any[]) => {
  const response = await callLocalAi<{ content: string }>("generateCVPoints", { logs });
  return response.content;
};
