// Runs after every successful write request: (1) audit log, (2) notifications, (3) live "sync" ping.
import AuditLog from "./models/AuditLog.js";
import Issue from "./models/Issue.js";
import Project from "./models/Project.js";
import { notify, broadcastSync } from "./realtime.js";

const ACTION = { POST: "create", PUT: "update", PATCH: "update", DELETE: "delete" };

export function activity(req, res, next) {
  if (req.method === "GET") return next();
  const orig = res.json.bind(res);
  res.json = (body) => { res.locals.body = body; return orig(body); }; // remember the created record's id
  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    run(req).catch((e) => console.error("activity:", e.message));
  });
  next();
}

async function run(req) {
  const [entity, entityId, sub] = req.path.split("/").filter(Boolean);
  const b = req.body || {};
  const label = b.summary || b.name || b.status || b.email || b.role || "";
  const action = ACTION[req.method] || req.method.toLowerCase();
  const u = req.user;
  await AuditLog.create({
    id: Math.random().toString(36).slice(2, 10), userId: u.id, userName: u.name, role: u.role,
    action, entity, entityId: entityId || "",
    summary: `${action} ${entity}${sub ? " " + sub : ""}${label ? ": " + String(label).slice(0, 80) : ""}`,
  });
  broadcastSync(u.id);

  // notifications are only about issues
  if (entity !== "issues") return;
  const id = entityId || req.res.locals.body?.id;
  const issue = id && (await Issue.findOne({ id }));
  if (!issue) return;
  const p = await Project.findOne({ id: issue.projectId });
  const key = `${p?.key || "ISSUE"}-${issue.num}`;
  const who = u.name;
  const stakeholders = [issue.assigneeId, issue.reporterId];
  if (req.method === "POST" && !entityId && issue.assigneeId) return notify([issue.assigneeId], { text: `${who} assigned you ${key}: ${issue.summary}`, issueId: issue.id, byId: u.id });
  if (sub === "comments" && req.method === "POST") return notify(stakeholders, { text: `${who} commented on ${key}`, issueId: issue.id, byId: u.id });
  if (sub === "attachments" && req.method === "POST") return notify(stakeholders, { text: `${who} attached a file to ${key}`, issueId: issue.id, byId: u.id });
  if (b.assigneeId && b.assigneeId === issue.assigneeId) await notify([issue.assigneeId], { text: `${who} assigned you ${key}: ${issue.summary}`, issueId: issue.id, byId: u.id });
  if (b.status && (sub === "move" || req.method === "PATCH")) await notify(stakeholders, { text: `${who} moved ${key} to ${issue.status}`, issueId: issue.id, byId: u.id });
}
