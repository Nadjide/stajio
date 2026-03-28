export const api = {
  auth: {
    me: () => fetch("/api/auth/me").then(res => res.json()),
    login: (credentials: any) => fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials)
    }).then(res => res.json()),
    register: (user: any) => fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user)
    }).then(res => res.json()),
    logout: () => fetch("/api/auth/logout", { method: "POST" }).then(res => res.json()),
  },
  profile: {
    get: () => fetch("/api/profile").then(res => res.json()),
    update: (profile: any) => fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile)
    }).then(res => res.json()),
  },
  logs: {
    list: () => fetch("/api/logs").then(res => res.json()),
    add: (log: any) => fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(log)
    }).then(res => res.json()),
    delete: (id: string) => fetch(`/api/logs/${id}`, { method: "DELETE" }).then(res => res.json()),
  },
  deadlines: {
    list: () => fetch("/api/deadlines").then(res => res.json()),
    add: (deadline: any) => fetch("/api/deadlines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deadline)
    }).then(res => res.json()),
    update: (id: string, completed: boolean) => fetch(`/api/deadlines/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed })
    }).then(res => res.json()),
    delete: (id: string) => fetch(`/api/deadlines/${id}`, { method: "DELETE" }).then(res => res.json()),
  }
};
