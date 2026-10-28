import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { api } from "./api.js";

export const STATUSES = ["To Do", "In Progress", "In Review", "Done"];
export const TYPES = ["Story", "Task", "Bug", "Epic"];
export const PRIORITIES = ["Highest", "High", "Medium", "Low", "Lowest"];

const uid = () => Math.random().toString(36).slice(2, 9);
const DAY = 86400000;
export const isoDay = (offset = 0) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
export const fmtDate = (s) => {
  if (!s) return "None";
  const d = new Date(s.length === 10 ? s + "T00:00:00" : s);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
export const timeAgo = (ts) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const COLORS = ["#0C66E4", "#E2483D", "#22A06B", "#9F8FEF", "#E56910", "#1D7AFC", "#C9372C"];

function seed() {
  const users = [
    { id: "u1", name: "Ankit Soni", email: "ankit@example.com", color: COLORS[0] },
    { id: "u2", name: "Riya Verma", email: "riya@example.com", color: COLORS[1] },
    { id: "u3", name: "Sahil Khan", email: "sahil@example.com", color: COLORS[2] },
    { id: "u4", name: "Karan Mehta", email: "karan@example.com", color: COLORS[3] },
    { id: "u5", name: "Priya Nair", email: "priya@example.com", color: COLORS[4] },
  ];
  const projects = [
    { id: "p1", key: "WEB", name: "Website Redesign", description: "Complete redesign of company website using React.", lead: "u1", starred: true, counter: 0, members: ["u1", "u2", "u3"] },
    { id: "p2", key: "CRM", name: "CRM System", description: "Customer Relationship Management dashboard.", lead: "u4", starred: false, counter: 0, members: ["u1", "u4", "u5"] },
    { id: "p3", key: "HMS", name: "Hospital Management", description: "Hospital ERP system.", lead: "u2", starred: false, counter: 0, members: ["u2", "u3", "u4", "u5"] },
  ];
  const sprints = [
    { id: "s1", projectId: "p1", name: "WEB Sprint 1", goal: "Ship the new landing page and auth", state: "active", start: isoDay(-5), end: isoDay(9) },
    { id: "s2", projectId: "p1", name: "WEB Sprint 2", goal: "", state: "future", start: "", end: "" },
  ];
  const issues = [];
  const add = (pk, o) => {
    const p = projects.find((x) => x.key === pk);
    p.counter += 1;
    const issue = {
      id: uid(), projectId: p.id, num: p.counter, type: "Task", status: "To Do", priority: "Medium",
      labels: [], comments: [], points: null, sprintId: null, epicId: null, assigneeId: null, reporterId: "u1",
      description: "", dueDate: "", startDate: "", createdAt: Date.now() - Math.floor(Math.random() * 6 * DAY), doneAt: null, ...o,
    };
    if (issue.status === "Done" && !issue.doneAt) issue.doneAt = Date.now() - Math.floor(Math.random() * 3 * DAY);
    issues.push(issue);
    return issue.id;
  };
  const e1 = add("WEB", { type: "Epic", summary: "New marketing site", status: "In Progress", startDate: isoDay(-10), dueDate: isoDay(40), description: "Everything needed to launch the new public website." });
  const e2 = add("WEB", { type: "Epic", summary: "Authentication & accounts", startDate: isoDay(5), dueDate: isoDay(60), description: "Login, signup, password reset." });
  add("WEB", { type: "Story", summary: "Design responsive landing page", status: "Done", priority: "High", points: 5, assigneeId: "u2", sprintId: "s1", epicId: e1, labels: ["design", "frontend"], description: "Hero, features, pricing and footer sections." });
  add("WEB", { type: "Story", summary: "Implement navbar with mobile menu", status: "In Review", priority: "Medium", points: 3, assigneeId: "u1", sprintId: "s1", epicId: e1, labels: ["frontend"] });
  add("WEB", { type: "Task", summary: "Set up CI pipeline", status: "In Progress", priority: "High", points: 2, assigneeId: "u3", sprintId: "s1", labels: ["devops"], dueDate: isoDay(2) });
  add("WEB", { type: "Bug", summary: "Footer links overlap on small screens", status: "To Do", priority: "Highest", points: 1, assigneeId: "u1", sprintId: "s1", epicId: e1, labels: ["bug", "css"], dueDate: isoDay(-1) });
  add("WEB", { type: "Story", summary: "Login page UI", status: "To Do", priority: "Medium", points: 5, assigneeId: "u2", sprintId: "s1", epicId: e2, labels: ["frontend"] });
  add("WEB", { type: "Task", summary: "Write API contract for auth", status: "Done", priority: "Low", points: 2, assigneeId: "u3", sprintId: "s1", epicId: e2 });
  add("WEB", { type: "Story", summary: "Password reset flow", priority: "Medium", points: 8, sprintId: "s2", epicId: e2 });
  add("WEB", { type: "Task", summary: "Add analytics events", priority: "Low", points: 3, sprintId: "s2" });
  add("WEB", { type: "Bug", summary: "Images not lazy-loading", priority: "Low", points: 2, labels: ["performance"] });
  add("WEB", { type: "Story", summary: "Dark mode support", priority: "Lowest", points: 5, labels: ["design"] });
  add("WEB", { type: "Task", summary: "Accessibility audit", priority: "Medium", points: 3 });
  add("CRM", { type: "Story", summary: "Customer list with filters", status: "In Progress", priority: "High", assigneeId: "u4", points: 5 });
  add("CRM", { type: "Task", summary: "Import contacts from CSV", assigneeId: "u5", points: 3 });
  add("CRM", { type: "Bug", summary: "Duplicate contacts on import", priority: "High", assigneeId: "u5", points: 2 });
  add("HMS", { type: "Story", summary: "Patient registration form", status: "Done", priority: "High", assigneeId: "u2", points: 5 });
  add("HMS", { type: "Task", summary: "Doctor schedule calendar", assigneeId: "u3", points: 8 });
  const sprintsAll = [
    ...sprints,
    { id: "s3", projectId: "p2", name: "CRM Sprint 1", goal: "", state: "future", start: "", end: "" },
  ];
  return { users, projects, sprints: sprintsAll, issues, currentProjectId: "p1", currentUserId: "u1", theme: "light" };
}

const KEY = "taskoraq-v1";
const OLD_KEY = "jira-clone-v1"; // pre-rename cache key (migrated on first load)
function load() {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  // real data comes from the backend (hydrate); don't flash fake demo records meanwhile
  return { ...seed(), users: [], projects: [], sprints: [], issues: [], currentProjectId: null };
}

function reducer(s, a) {
  switch (a.type) {
    case "addIssue": {
      const p = s.projects.find((x) => x.id === a.issue.projectId);
      const num = p.counter + 1;
      const issue = {
        type: "Task", status: "To Do", priority: "Medium", labels: [], comments: [], points: null, sprintId: null,
        epicId: null, assigneeId: null, reporterId: s.currentUserId, description: "", dueDate: "", startDate: "",
        ...a.issue, id: a.id || uid(), num, createdAt: Date.now(), doneAt: null,
      };
      if (issue.status === "Done") issue.doneAt = Date.now();
      return { ...s, projects: s.projects.map((x) => (x.id === p.id ? { ...x, counter: num } : x)), issues: [...s.issues, issue] };
    }
    case "updateIssue":
      return {
        ...s,
        issues: s.issues.map((i) => {
          if (i.id !== a.id) return i;
          const n = { ...i, ...a.patch };
          if (a.patch.status && a.patch.status !== i.status) n.doneAt = a.patch.status === "Done" ? Date.now() : null;
          return n;
        }),
      };
    case "moveIssue": {
      const issue = s.issues.find((i) => i.id === a.id);
      if (!issue) return s;
      const rest = s.issues.filter((i) => i.id !== a.id);
      const moved = { ...issue, status: a.status, doneAt: a.status === "Done" ? issue.doneAt || Date.now() : null };
      const idx = a.beforeId ? rest.findIndex((i) => i.id === a.beforeId) : -1;
      if (idx < 0) rest.push(moved);
      else rest.splice(idx, 0, moved);
      return { ...s, issues: rest };
    }
    case "deleteIssue":
      return { ...s, issues: s.issues.filter((i) => i.id !== a.id).map((i) => (i.epicId === a.id ? { ...i, epicId: null } : i)) };
    case "addComment":
      return {
        ...s,
        issues: s.issues.map((i) =>
          i.id === a.id ? { ...i, comments: [...i.comments, { id: a.commentId || uid(), userId: s.currentUserId, text: a.text, at: Date.now() }] } : i
        ),
      };
    case "deleteComment":
      return { ...s, issues: s.issues.map((i) => (i.id === a.id ? { ...i, comments: i.comments.filter((c) => c.id !== a.commentId) } : i)) };
    case "addSprint": {
      const n = s.sprints.filter((x) => x.projectId === a.projectId).length + 1;
      const p = s.projects.find((x) => x.id === a.projectId);
      return { ...s, sprints: [...s.sprints, { id: a.id || uid(), projectId: a.projectId, name: `${p.key} Sprint ${n}`, goal: "", state: "future", start: "", end: "" }] };
    }
    case "updateSprint":
      return { ...s, sprints: s.sprints.map((x) => (x.id === a.id ? { ...x, ...a.patch } : x)) };
    case "startSprint":
      return { ...s, sprints: s.sprints.map((x) => (x.id === a.id ? { ...x, ...a.patch, state: "active" } : x)) };
    case "completeSprint":
      return {
        ...s,
        sprints: s.sprints.map((x) => (x.id === a.id ? { ...x, state: "closed", end: x.end || isoDay() } : x)),
        issues: s.issues.map((i) => (i.sprintId === a.id && i.status !== "Done" ? { ...i, sprintId: a.moveTo || null } : i)),
      };
    case "deleteSprint":
      return { ...s, sprints: s.sprints.filter((x) => x.id !== a.id), issues: s.issues.map((i) => (i.sprintId === a.id ? { ...i, sprintId: null } : i)) };
    case "addProject": {
      const id = a.id || uid();
      return {
        ...s,
        projects: [...s.projects, { id, key: a.key, name: a.name, description: a.description || "", lead: s.currentUserId, starred: false, counter: 0, members: s.users.map((u) => u.id) }],
        currentProjectId: id,
      };
    }
    case "updateProject":
      return { ...s, projects: s.projects.map((p) => (p.id === a.id ? { ...p, ...a.patch } : p)) };
    case "deleteProject": {
      const projects = s.projects.filter((p) => p.id !== a.id);
      return {
        ...s,
        projects,
        issues: s.issues.filter((i) => i.projectId !== a.id),
        sprints: s.sprints.filter((x) => x.projectId !== a.id),
        currentProjectId: s.currentProjectId === a.id ? projects[0]?.id || null : s.currentProjectId,
      };
    }
    case "setProject":
      return { ...s, currentProjectId: a.id };
    case "setTheme":
      return { ...s, theme: a.theme };
    case "setUser":
      return { ...s, currentUserId: a.id };
    case "hydrate": // replace data with what the server has (UI prefs stay local)
      return {
        ...s,
        users: a.data.users,
        projects: a.data.projects,
        sprints: a.data.sprints,
        issues: a.data.issues,
        currentProjectId: a.data.projects.some((p) => p.id === s.currentProjectId) ? s.currentProjectId : a.data.projects[0]?.id || null,
        currentUserId: a.meId || s.currentUserId,
      };
    case "syncIssue": // server-confirmed issue (real number/ids)
      return {
        ...s,
        issues: s.issues.map((i) => (i.id === a.issue.id ? { ...i, ...a.issue } : i)),
        projects: s.projects.map((p) => (p.id === a.issue.projectId ? { ...p, counter: Math.max(p.counter, a.issue.num) } : p)),
      };
    case "reset": // the server restores its demo data, then refresh() hydrates the UI
      return s;
    default:
      return s;
  }
}

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

// who may do what: viewer = read only | coadmin = all work items + sprints + project settings | admin = everything
const LOCAL_ACTIONS = ["setProject", "setTheme", "setUser", "hydrate", "syncIssue"];
const ADMIN_ONLY = ["deleteProject", "reset"];
export const ROLE_LABEL = { admin: "Admin", coadmin: "Co-admin", viewer: "Viewer" };

export function AppProvider({ children, authUser, onLogout }) {
  const [state, rawDispatch] = useReducer(reducer, null, () => ({ ...load(), currentUserId: authUser.id }));
  const stateRef = useRef(state);
  stateRef.current = state;
  const [view, setView] = useState("dashboard");
  const [openIssueId, setOpenIssueId] = useState(null);
  const [createDraft, setCreateDraft] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state]);
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);
  const roleNow = state.users.find((u) => u.id === authUser.id)?.role || authUser.role || "viewer";
  useEffect(() => {
    document.documentElement.dataset.role = roleNow; // CSS hides edit-only controls for viewers / co-admins
  }, [roleNow]);

  const notify = useCallback((msg) => {
    setToast({ msg, id: Date.now() });
  }, []);

  // pull the latest data from the backend
  const refresh = useCallback(async () => {
    const data = await api.bootstrap();
    rawDispatch({ type: "hydrate", data, meId: authUser.id });
  }, [authUser.id]);

  useEffect(() => {
    refresh().catch(() => notify("Backend not reachable - is the server running on :5000?"));
  }, [refresh, notify]);

  // optimistic update first (instant UI), then persist to the API; on failure re-sync from server
  const dispatch = useCallback(
    (action) => {
      const st = stateRef.current;
      const role = st.users.find((u) => u.id === authUser.id)?.role || authUser.role;
      if (!LOCAL_ACTIONS.includes(action.type)) {
        if (role === "viewer") return notify("Viewers have read-only access");
        if (role !== "admin" && ADMIN_ONLY.includes(action.type)) return notify("Only an admin can do this");
      }
      let a = action;
      let call = null;
      switch (action.type) {
        case "addIssue": {
          a = { ...action, id: uid() };
          const issue = { ...action.issue, id: a.id, reporterId: st.currentUserId };
          call = () => api.addIssue(issue).then((saved) => rawDispatch({ type: "syncIssue", issue: saved }));
          break;
        }
        case "updateIssue": call = () => api.updateIssue(action.id, action.patch); break;
        case "moveIssue": call = () => api.moveIssue(action.id, action.status, action.beforeId); break;
        case "deleteIssue": call = () => api.deleteIssue(action.id); break;
        case "addComment": {
          a = { ...action, commentId: uid() };
          call = () => api.addComment(action.id, { id: a.commentId, userId: st.currentUserId, text: action.text });
          break;
        }
        case "deleteComment": call = () => api.deleteComment(action.id, action.commentId); break;
        case "addSprint":
          a = { ...action, id: uid() };
          call = () => api.addSprint({ id: a.id, projectId: action.projectId });
          break;
        case "updateSprint": call = () => api.updateSprint(action.id, action.patch); break;
        case "startSprint": call = () => api.startSprint(action.id, action.patch); break;
        case "completeSprint": call = () => api.completeSprint(action.id, action.moveTo); break;
        case "deleteSprint": call = () => api.deleteSprint(action.id); break;
        case "addProject":
          a = { ...action, id: uid() };
          call = () =>
            api.addProject({
              id: a.id, key: action.key, name: action.name, description: action.description || "",
              lead: st.currentUserId, members: st.users.map((u) => u.id),
            });
          break;
        case "updateProject": call = () => api.updateProject(action.id, action.patch); break;
        case "deleteProject": call = () => api.deleteProject(action.id); break;
        case "reset": call = () => api.reset().then(refresh); break;
        default: break; // setProject / setTheme / setUser are local UI state
      }
      rawDispatch(a);
      if (call) {
        call().catch((e) => {
          notify(e.message || "Could not save to server");
          refresh().catch(() => {});
        });
      }
    },
    [notify, refresh, authUser]
  );
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const value = useMemo(() => {
    const project = state.projects.find((p) => p.id === state.currentProjectId) || null;
    const usersById = Object.fromEntries(state.users.map((u) => [u.id, u]));
    const projectsById = Object.fromEntries(state.projects.map((p) => [p.id, p]));
    const me = { ...authUser, ...usersById[authUser.id] };
    const role = me.role || "viewer";
    const can = { edit: role !== "viewer", deleteProject: role === "admin", manageUsers: role === "admin" };
    const keyOf = (i) => `${projectsById[i.projectId]?.key || "?"}-${i.num}`;
    const projectIssues = project ? state.issues.filter((i) => i.projectId === project.id) : [];
    const projectSprints = project ? state.sprints.filter((x) => x.projectId === project.id) : [];
    return {
      state, dispatch, project, usersById, projectsById, me, role, can, onLogout, refresh, keyOf, projectIssues, projectSprints,
      view, setView, openIssueId, setOpenIssueId, createDraft, setCreateDraft, toast, notify,
    };
  }, [state, view, openIssueId, createDraft, toast, notify, authUser, onLogout, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
