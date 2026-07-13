export interface User {
  uid: string;
  email: string;
  displayName: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  school: string;
  degree: string;
  internshipStart: string;
  internshipEnd: string;
  company: string;
  tutorName: string;
}

export interface LogEntry {
  id: string;
  uid: string;
  date: string;
  rawContent: string;
  structuredContent: string;
  skills: string[];
  weekNumber: number;
  summary?: string;
  missions?: string[];
  technologies?: string[];
}

export interface Deadline {
  id: string;
  uid: string;
  title: string;
  date: string;
  type: "school" | "company";
  completed: boolean;
}

export type AiOutputType = "report" | "defense" | "cv" | "chat";

export interface AiOutput {
  id: string;
  uid: string;
  type: AiOutputType;
  title: string;
  content: string;
  createdAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DefenseEvaluation {
  score: number;
  feedback: string;
  improvedAnswer: string;
}

export interface DefensePrep {
  plan: string[];
  questions: Array<{ question: string; answerHint: string }>;
}
