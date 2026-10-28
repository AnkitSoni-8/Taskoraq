// Thin fetch wrapper for the Express backend (see /backend).
// In dev, Vite proxies /api -> http://localhost:5000 (vite.config.js).
// For production set VITE_API_URL, e.g. https://api.example.com/api
const BASE = import.meta.env.VITE_API_URL || "/api";

const TOKEN_KEY = "taskoraq-token";
const OLD_TOKEN_KEY = "jira-clone-token"; // pre-rename key: still honoured so open sessions stay logged in
// Token lives in sessionStorage: every new browser tab/session starts on the login page.
try { localStorage.removeItem(TOKEN_KEY); } catch {} // drop old auto-login tokens from earlier versions
export const auth = {
  get: () => {
    const old = sessionStorage.getItem(OLD_TOKEN_KEY);
    if (old && !sessionStorage.getItem(TOKEN_KEY)) { sessionStorage.setItem(TOKEN_KEY, old); sessionStorage.removeItem(OLD_TOKEN_KEY); }
    return sessionStorage.getItem(TOKEN_KEY);
  },
  set: (t) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(OLD_TOKEN_KEY); },
};

async function req(method, path, body) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth.get()) headers.Authorization = `Bearer ${auth.get()}`;
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  // the dev proxy answers 500/502/504 with an empty body when the API server is down
  if (!res.ok && !data.error && res.status >= 500)
    throw Object.assign(new Error("Backend server is not running. Start everything with: npm run dev"), { status: res.status });
  // expired / invalid session -> AuthGate listens and shows the login screen
  if (res.status === 401 && path !== "/auth/login") window.dispatchEvent(new Event("auth:logout"));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}

export const api = {
  login: (email, password) => req("POST", "/auth/login", { email, password }),
  register: (name, email, password, inviteToken) => req("POST", "/auth/register", { name, email, password, inviteToken }),
  inviteInfo: (t) => req("GET", `/auth/invite/${t}`),
  notifications: () => req("GET", "/notifications"),
  readAllNotifications: () => req("POST", "/notifications/read-all"),
  readNotification: (id) => req("POST", `/notifications/${id}/read`),
  audit: (qs = "") => req("GET", "/audit" + qs),
  invites: () => req("GET", "/invites"),
  addInvite: (email, role) => req("POST", "/invites", { email, role }),
  deleteInvite: (token) => req("DELETE", `/invites/${token}`),
  deleteAttachment: (issueId, attId) => req("DELETE", `/issues/${issueId}/attachments/${attId}`),
  async uploadFile(issueId, file) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(BASE + `/issues/${issueId}/attachments`, { method: "POST", headers: { Authorization: `Bearer ${auth.get()}` }, body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    return data;
  },
  me: () => req("GET", "/auth/me"),
  addUser: (u) => req("POST", "/users", u),
  updateUser: (id, patch) => req("PATCH", `/users/${id}`, patch),
  deleteUser: (id) => req("DELETE", `/users/${id}`),

  bootstrap: () => req("GET", "/bootstrap"),
  reset: () => req("POST", "/reset"),

  addProject: (p) => req("POST", "/projects", p),
  updateProject: (id, patch) => req("PATCH", `/projects/${id}`, patch),
  deleteProject: (id) => req("DELETE", `/projects/${id}`),

  addSprint: (s) => req("POST", "/sprints", s),
  updateSprint: (id, patch) => req("PATCH", `/sprints/${id}`, patch),
  startSprint: (id, patch) => req("POST", `/sprints/${id}/start`, patch),
  completeSprint: (id, moveTo) => req("POST", `/sprints/${id}/complete`, { moveTo }),
  deleteSprint: (id) => req("DELETE", `/sprints/${id}`),

  addIssue: (i) => req("POST", "/issues", i),
  updateIssue: (id, patch) => req("PATCH", `/issues/${id}`, patch),
  moveIssue: (id, status, beforeId) => req("PUT", `/issues/${id}/move`, { status, beforeId }),
  deleteIssue: (id) => req("DELETE", `/issues/${id}`),

  addComment: (issueId, c) => req("POST", `/issues/${issueId}/comments`, c),
  deleteComment: (issueId, commentId) => req("DELETE", `/issues/${issueId}/comments/${commentId}`),
};

// attachment urls come back as /api/uploads/...; prefix the API origin when the API is hosted elsewhere
// Attachments are login-protected: fetch with the token, then save the blob (a plain <a href> cannot send the Authorization header).
export async function downloadFile(att) {
  const res = await fetch(fileUrl(att.url), { headers: { Authorization: `Bearer ${auth.get()}` } });
  if (res.status === 401) window.dispatchEvent(new Event("auth:logout"));
  if (!res.ok) throw new Error(res.status === 404 ? "File not found" : `Download failed (${res.status})`);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await res.blob());
  a.download = att.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const fileUrl = (u) => (import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL, location.href).origin + u : u);
