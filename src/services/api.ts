async function handleResponse(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `Erreur serveur (${res.status})`);
  }
  return data;
}

const jsonRequest = (url: string, method: string, body?: unknown) =>
  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }).then(handleResponse);

export const api = {
  auth: {
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
  profile: {
    get: () => fetch("/api/profile").then(handleResponse),
    update: (profile: unknown) => jsonRequest("/api/profile", "POST", profile),
  },
  logs: {
    list: () => fetch("/api/logs").then(handleResponse),
    add: (log: unknown) => jsonRequest("/api/logs", "POST", log),
    update: (id: string, log: unknown) => jsonRequest(`/api/logs/${id}`, "PUT", log),
    delete: (id: string) => fetch(`/api/logs/${id}`, { method: "DELETE" }).then(handleResponse),
  },
  deadlines: {
    list: () => fetch("/api/deadlines").then(handleResponse),
    add: (deadline: unknown) => jsonRequest("/api/deadlines", "POST", deadline),
    update: (
      id: string,
      changes: { title?: string; date?: string; type?: "school" | "company"; completed?: boolean },
    ) => jsonRequest(`/api/deadlines/${id}`, "PATCH", changes),
    delete: (id: string) => fetch(`/api/deadlines/${id}`, { method: "DELETE" }).then(handleResponse),
  },
  aiOutputs: {
    list: () => fetch("/api/ai-outputs").then(handleResponse),
    save: (output: { type: string; title: string; content: string }) =>
      jsonRequest("/api/ai-outputs", "POST", output),
    delete: (id: string) =>
      fetch(`/api/ai-outputs/${id}`, { method: "DELETE" }).then(handleResponse),
  },
  models: {
    list: () =>
      fetch("/api/ai/models").then(handleResponse) as Promise<{ models: string[]; default: string }>,
  },
  data: {
    exportUrl: "/api/export",
    import: (data: unknown) => jsonRequest("/api/import", "POST", data),
  },
};
