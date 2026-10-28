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

/** Copy of a journal note as the model saw it; later journal edits do not change it. */
export interface SourceSnapshot {
  id: string;
  date: string;
  text: string;
}

export interface AiOutput {
  id: string;
  uid: string;
  type: AiOutputType;
  title: string;
  content: string;
  createdAt: string;
  updatedAt?: string | null;
  model?: string | null;
  instructions?: string | null;
  sources?: SourceSnapshot[];
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

export interface AiStatus {
  reachable: boolean;
  defaultModel: string;
  models: string[];
  contextTokens: number;
  inputBudgetTokens: number;
}

export interface ReportBrief {
  guidelines: string;
  problem: string;
  targetLength: string;
  periodStart: string;
  periodEnd: string;
  sourceLogIds: string[];
}

export interface ReportSection {
  id: string;
  title: string;
  intent: string;
  content: string;
  generatedAt: string | null;
  model: string | null;
}

export interface ReportProvenance {
  model: string;
  generatedAt: string;
  instructions: string;
  sources: SourceSnapshot[];
}

export type ReportStatus = "draft" | "validated";

export interface Report {
  id: string;
  title: string;
  brief: ReportBrief;
  sections: ReportSection[];
  status: ReportStatus;
  provenance: ReportProvenance | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  validatedAt: string | null;
}

export interface ReportVersion {
  id: string;
  reportId: string;
  label: string;
  title: string;
  sections: ReportSection[];
  createdAt: string;
}

export type SkillLevel = "to_work" | "practicing" | "autonomous";

export interface Skill {
  id: string;
  label: string;
  goal: string;
  level: SkillLevel;
  logIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type MessageStatus = "complete" | "interrupted";

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: MessageStatus;
  model: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  messages?: ConversationMessage[];
}

export interface SimulationStep {
  question: string;
  answerHint: string;
  answer: string | null;
  evaluation: DefenseEvaluation | null;
}

export interface SimulationContext {
  model: string;
  generatedAt: string;
  sources: SourceSnapshot[];
}

export interface Simulation {
  id: string;
  title: string;
  status: "in_progress" | "finished";
  currentStep: number;
  steps: SimulationStep[];
  context: SimulationContext;
  createdAt: string;
  updatedAt: string;
}
