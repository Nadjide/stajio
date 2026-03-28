import { GoogleGenAI, Type } from "@google/genai";

const getAi = () => new GoogleGenAI({
  apiKey:
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    "",
});

export const structureLog = async (rawContent: string) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Structure cette entrée de journal de bord d'alternance. 
    Extrais les missions, les technologies utilisées et les compétences acquises.
    Réponds en français.
    
    Entrée brute : ${rawContent}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: "Résumé structuré de la semaine" },
          missions: { type: Type.ARRAY, items: { type: Type.STRING } },
          technologies: { type: Type.ARRAY, items: { type: Type.STRING } },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["summary", "missions", "technologies", "skills"]
      }
    }
  });
  return JSON.parse(response.text);
};

export const generateReport = async (userData: any, logs: any[]) => {
  const ai = getAi();
  const logsContext = logs.map(l => `Semaine ${l.weekNumber}: ${l.structuredContent}`).join("\n");
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Génère un rapport de stage structuré pour un étudiant en ${userData.degree} à ${userData.school}.
    L'alternance se déroule chez ${userData.company}.
    
    Voici le journal de bord :
    ${logsContext}
    
    Le rapport doit inclure : Introduction, Présentation de l'entreprise, Missions réalisées, Bilan technique, Conclusion.
    Réponds en français au format Markdown.`,
  });
  return response.text;
};

export const prepareDefense = async (userData: any, logs: any[]) => {
  const ai = getAi();
  const logsContext = logs.map(l => l.structuredContent).join("\n");
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Prépare une soutenance pour un étudiant en ${userData.degree}.
    Entreprise: ${userData.company}.
    Expérience: ${logsContext}
    
    Génère un plan de présentation et 5 questions probables du jury avec des pistes de réponses.
    Réponds en français au format JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          plan: { type: Type.ARRAY, items: { type: Type.STRING } },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                answerHint: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });
  return JSON.parse(response.text);
};

export const generateCVPoints = async (logs: any[]) => {
  const ai = getAi();
  const logsContext = logs.map(l => l.structuredContent).join("\n");
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Transforme ces expériences d'alternance en bullet points optimisés pour un CV (format ATS).
    Utilise des verbes d'action et quantifie les résultats si possible.
    
    Expériences: ${logsContext}
    
    Réponds en français par une liste de bullet points.`,
  });
  return response.text;
};

export const generateLogo = async (prompt: string) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: {
      parts: [
        {
          text: prompt,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: "1K"
      }
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      const base64EncodeString = part.inlineData.data;
      return `data:${part.inlineData.mimeType};base64,${base64EncodeString}`;
    }
  }
  throw new Error("No image generated");
};
