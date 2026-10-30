import type {
  MessageStatus,
  ReportBrief,
  ReportProvenance,
  ReportSection,
  SimulationContext,
  SimulationStep,
  SkillLevel,
  SourceSnapshot,
} from "./models";

export type BackupProfile = {
  displayName: string | null;
  school: string | null;
  degree: string | null;
  internshipStart: string | null;
  internshipEnd: string | null;
  company: string | null;
  tutorName: string | null;
};

export type BackupLog = {
  id: string;
  date: string;
  rawContent: string;
  structuredContent: string | null;
  skills: string[];
  weekNumber: number;
  summary: string | null;
  missions: string[];
  technologies: string[];
};

export type BackupDeadline = {
  id: string;
  title: string;
  date: string;
  type: "school" | "company";
  completed: boolean;
};

export type BackupAiOutput = {
  id: string;
  type: "report" | "defense" | "cv" | "chat";
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  model: string | null;
  instructions: string | null;
  sources: SourceSnapshot[] | null;
};

export type BackupDraft = { key: string; content: string; updatedAt: string };

export type BackupReport = {
  id: string;
  title: string;
  brief: ReportBrief;
  sections: ReportSection[];
  status: "draft" | "validated";
  provenance: ReportProvenance | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  validatedAt: string | null;
};

export type BackupReportVersion = {
  id: string;
  reportId: string;
  label: string;
  title: string;
  sections: ReportSection[];
  createdAt: string;
};

export type BackupSkill = {
  id: string;
  label: string;
  goal: string;
  level: SkillLevel;
  createdAt: string;
  updatedAt: string;
};

export type BackupSkillEvidence = { skillId: string; logId: string; createdAt: string };

export type BackupConversation = { id: string; title: string; createdAt: string; updatedAt: string };

export type BackupConversationMessage = {
  id: string;
  conversationId: string;
  position: number;
  role: "user" | "assistant";
  content: string;
  status: MessageStatus;
  model: string | null;
  createdAt: string;
};

export type BackupSimulation = {
  id: string;
  title: string;
  status: "in_progress" | "finished";
  currentStep: number;
  steps: SimulationStep[];
  context: SimulationContext;
  createdAt: string;
  updatedAt: string;
};

/** Version the format when a later feature adds a collection or changes its shape. */
export type BackupDocument = {
  format: "stajio";
  version: 3;
  exportedAt: string;
  profile: BackupProfile;
  logs: BackupLog[];
  deadlines: BackupDeadline[];
  aiOutputs: BackupAiOutput[];
  drafts: BackupDraft[];
  reports: BackupReport[];
  reportVersions: BackupReportVersion[];
  skills: BackupSkill[];
  skillEvidence: BackupSkillEvidence[];
  conversations: BackupConversation[];
  conversationMessages: BackupConversationMessage[];
  simulations: BackupSimulation[];
};

export const BACKUP_COLLECTIONS = [
  "logs",
  "deadlines",
  "aiOutputs",
  "drafts",
  "reports",
  "reportVersions",
  "skills",
  "skillEvidence",
  "conversations",
  "conversationMessages",
  "simulations",
] as const;

export type BackupCollection = (typeof BACKUP_COLLECTIONS)[number];

export type BackupCounts = Record<BackupCollection, number>;

export type BackupPreview = {
  version: 1 | 2 | 3;
  exportedAt: string;
  profile: BackupProfile;
  incoming: BackupCounts;
  current: BackupCounts;
  backupHash: string;
  currentHash: string;
};
