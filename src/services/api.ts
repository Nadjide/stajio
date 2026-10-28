import type { BackupPreview } from "../types/backup";
import type {
  AiOutput,
  AiStatus,
  Conversation,
  Deadline,
  Report,
  ReportVersion,
  Simulation,
  Skill,
  SkillLevel,
  UserProfile,
} from "../types/models";

/** Carries the HTTP status and body so callers can react to conflicts precisely. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const details = Array.isArray(data?.details) ? data.details.join(" ; ") : "";
    throw new ApiError(
      [data?.error || `Erreur serveur (${res.status})`, details].filter(Boolean).join(" : "),
      res.status,
      data,
    );
  }
  return data;
}

const jsonRequest = (url: string, method: string, body?: unknown, init: RequestInit = {}) =>
  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...init,
  }).then(handleResponse);

const get = <T>(url: string, init?: RequestInit) => fetch(url, init).then(handleResponse) as Promise<T>;
const remove = (url: string) => fetch(url, { method: "DELETE" }).then(handleResponse);

export type Draft = { key: string; content: string; updatedAt: string };
export type DeadlineInput = { title: string; date: string; type: "school" | "company" };

export const api = {
  auth: {
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      jsonRequest("/api/auth/password", "POST", data),
    me: () => fetch("/api/auth/me").then((res) => res.json()),
    login: (credentials: { email: string; password: string }) =>
      fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      }).then((res) => res.json()),
    register: (user: { email: string; password: string; displayName: string }) =>
      fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      }).then((res) => res.json()),
    logout: () => fetch("/api/auth/logout", { method: "POST" }).then((res) => res.json()),
  },
  account: {
    remove: (data: { currentPassword: string; confirmation: "SUPPRIMER"; scope: "data" | "account" }) =>
      jsonRequest("/api/account", "DELETE", data),
  },
  onboarding: {
    complete: (data: { profile: Omit<UserProfile, "uid" | "email">; deadlines: DeadlineInput[] }) =>
      jsonRequest("/api/onboarding", "POST", data),
  },
  profile: {
    get: () => fetch("/api/profile").then(handleResponse),
    update: (profile: unknown) => jsonRequest("/api/profile", "POST", profile),
  },
  drafts: {
    get: (key: string) => get<{ draft: Draft | null }>(`/api/drafts/${encodeURIComponent(key)}`),
    /** keepalive lets the last save finish while the page is closing. */
    save: (key: string, content: string, keepalive = false) =>
      jsonRequest(`/api/drafts/${encodeURIComponent(key)}`, "PUT", { content }, { keepalive }) as Promise<{
        draft: Draft;
      }>,
    delete: (key: string) => remove(`/api/drafts/${encodeURIComponent(key)}`),
  },
  logs: {
    list: () => fetch("/api/logs").then(handleResponse),
    add: (log: unknown) => jsonRequest("/api/logs", "POST", log) as Promise<{ success: true; id: string }>,
    update: (id: string, log: unknown) => jsonRequest(`/api/logs/${id}`, "PUT", log),
    delete: (id: string) => remove(`/api/logs/${id}`),
  },
  deadlines: {
    list: () => fetch("/api/deadlines").then(handleResponse),
    add: (deadline: unknown) => jsonRequest("/api/deadlines", "POST", deadline),
    update: (id: string, changes: Partial<Omit<Deadline, "id" | "uid">>) =>
      jsonRequest(`/api/deadlines/${id}`, "PATCH", changes),
    delete: (id: string) => remove(`/api/deadlines/${id}`),
    calendarUrl: "/api/deadlines/calendar",
  },
  skills: {
    list: () => get<Skill[]>("/api/skills"),
    create: (skill: { label: string; goal?: string; level?: SkillLevel; logIds?: string[] }) =>
      jsonRequest("/api/skills", "POST", skill) as Promise<Skill>,
    update: (id: string, changes: { label?: string; goal?: string; level?: SkillLevel; logIds?: string[] }) =>
      jsonRequest(`/api/skills/${id}`, "PATCH", changes) as Promise<Skill>,
    merge: (sourceId: string, targetId: string) =>
      jsonRequest("/api/skills/merge", "POST", { sourceId, targetId }) as Promise<Skill>,
    delete: (id: string) => remove(`/api/skills/${id}`),
  },
  reports: {
    list: () => get<Report[]>("/api/reports"),
    create: (title?: string) => jsonRequest("/api/reports", "POST", title ? { title } : {}) as Promise<Report>,
    get: (id: string) => get<Report>(`/api/reports/${id}`),
    save: (report: Report, keepalive = false) =>
      jsonRequest(
        `/api/reports/${report.id}`,
        "PUT",
        {
          revision: report.revision,
          title: report.title,
          brief: report.brief,
          sections: report.sections,
          status: report.status,
          provenance: report.provenance,
        },
        { keepalive },
      ) as Promise<Report>,
    delete: (id: string) => remove(`/api/reports/${id}`),
    versions: (id: string) => get<ReportVersion[]>(`/api/reports/${id}/versions`),
    saveVersion: (id: string, label: string) =>
      jsonRequest(`/api/reports/${id}/versions`, "POST", { label }) as Promise<ReportVersion>,
    restoreVersion: (id: string, versionId: string, revision: number) =>
      jsonRequest(`/api/reports/${id}/versions/${versionId}`, "POST", { revision }) as Promise<Report>,
  },
  conversations: {
    list: () => get<Conversation[]>("/api/conversations"),
    create: () => jsonRequest("/api/conversations", "POST", {}) as Promise<Conversation>,
    get: (id: string) => get<Conversation>(`/api/conversations/${id}`),
    rename: (id: string, title: string) =>
      jsonRequest(`/api/conversations/${id}`, "PATCH", { title }) as Promise<Conversation>,
    delete: (id: string) => remove(`/api/conversations/${id}`),
  },
  simulations: {
    list: () => get<Simulation[]>("/api/simulations"),
    create: (model?: string, signal?: AbortSignal) =>
      jsonRequest("/api/simulations", "POST", model ? { model } : {}, { signal }) as Promise<Simulation>,
    get: (id: string) => get<Simulation>(`/api/simulations/${id}`),
    update: (id: string, changes: Partial<Pick<Simulation, "title" | "currentStep" | "status">>) =>
      jsonRequest(`/api/simulations/${id}`, "PATCH", changes) as Promise<Simulation>,
    answer: (id: string, index: number, answer: string, model?: string, signal?: AbortSignal) =>
      jsonRequest(
        `/api/simulations/${id}/answer`,
        "POST",
        { index, answer, ...(model ? { model } : {}) },
        {
          signal,
        },
      ) as Promise<Simulation>,
    delete: (id: string) => remove(`/api/simulations/${id}`),
  },
  aiOutputs: {
    list: () => get<AiOutput[]>("/api/ai-outputs"),
    save: (
      output: Pick<AiOutput, "type" | "title" | "content"> &
        Partial<Pick<AiOutput, "model" | "instructions" | "sources">>,
    ) => jsonRequest("/api/ai-outputs", "POST", output) as Promise<{ success: true; id: string; output: AiOutput }>,
    update: (id: string, changes: { title?: string; content?: string }) =>
      jsonRequest(`/api/ai-outputs/${id}`, "PATCH", changes) as Promise<AiOutput>,
    delete: (id: string) => remove(`/api/ai-outputs/${id}`),
  },
  ai: {
    status: () => get<AiStatus>("/api/ai/status"),
    estimate: (
      request:
        | { task: "report"; reportId: string; logIds?: string[] }
        | { task: "cv" | "defense"; logIds?: string[] }
        | { task: "chat" },
    ) =>
      jsonRequest("/api/ai/estimate", "POST", request) as Promise<{
        estimatedTokens: number;
        budgetTokens: number;
        fits: boolean;
        noteCount: number;
      }>,
  },
  models: {
    list: () => fetch("/api/ai/models").then(handleResponse) as Promise<{ models: string[]; default: string }>,
  },
  data: {
    exportUrl: "/api/export",
    preview: (backup: unknown) =>
      jsonRequest("/api/import/preview", "POST", { backup }) as Promise<{
        preview: BackupPreview;
      }>,
    import: (backup: unknown, preview: BackupPreview) =>
      jsonRequest("/api/import", "POST", {
        backup,
        confirmation: "REMPLACER",
        backupHash: preview.backupHash,
        currentHash: preview.currentHash,
      }),
  },
};
