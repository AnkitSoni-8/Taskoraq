import { Router } from "express";
import User from "../models/User.js";
import Project from "../models/Project.js";
import Sprint from "../models/Sprint.js";
import Issue from "../models/Issue.js";
import { seedData } from "../seed.js";
import { authenticate, requireRole } from "../auth.js";
import authRoutes from "./auth.js";
import userRoutes from "./users.js";
import extraRoutes from "./extras.js";
import { activity } from "../activity.js";
import { isStr, bad, isValidDate } from "../validate.js";

const r = Router();

// public: login / register.  Everything after this line needs a valid token.
r.use("/auth", authRoutes);
r.use(authenticate);
r.use(activity);        // audit log + notifications + live sync after each successful write
r.use("/users", userRoutes);
r.use(extraRoutes);     // notifications, audit, invites, attachments (own role checks inside)

// Role rules: viewer = read only | coadmin = create/edit/delete work items | admin = everything
const staff = requireRole("admin", "coadmin");
const adminOnly = requireRole("admin");
r.use((req, res, next) => {
  if (req.method === "GET") return next();
  if (req.path === "/reset") return adminOnly(req, res, next);
  if (req.method === "DELETE" && /^\/projects\/[^/]+$/.test(req.path)) return adminOnly(req, res, next);
  return staff(req, res, next);
});
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const uid = () => Math.random().toString(36).slice(2, 9);
const isoDay = () => new Date().toISOString().slice(0, 10);
const notFound = (what) => Object.assign(new Error(`${what} not found`), { status: 404 });

const KEY_RE = /^[A-Z]{2,6}$/; // same rule as the "Create project" form
const pick = (body, fields) => Object.fromEntries(fields.filter((k) => body?.[k] !== undefined).map((k) => [k, body[k]]));
const text = (v, what, { max, required = false } = {}) => {
  if (v === undefined || v === null) { if (required) throw bad(`${what} is required`); return v; }
  if (!isStr(v)) throw bad(`${what} must be text`);
  const t = v.trim();
  if (required && !t) throw bad(`${what} is required`);
  if (max && t.length > max) throw bad(`${what} must be at most ${max} characters`);
  return t;
};
// optional date field: "" / null clears it, anything else must be a real YYYY-MM-DD date
const dateField = (v, what) => {
  if (v === undefined) return v;
  if (v === null || v === "") return "";
  if (!isValidDate(v)) throw bad(`${what} must be a real date (YYYY-MM-DD)`);
  return v;
};
// sprintId / epicId must exist and belong to the same project as the issue
async function checkLinks(projectId, { sprintId, epicId }) {
  if (sprintId) {
    const s = await Sprint.findOne({ id: String(sprintId) });
    if (!s || s.projectId !== projectId) throw bad("Sprint does not belong to this project");
  }
  if (epicId) {
    const e = await Issue.findOne({ id: String(epicId) });
    if (!e || e.projectId !== projectId || e.type !== "Epic") throw bad("Epic does not belong to this project");
  }
}

// the UI creates records optimistically with its own id: accept it if it is well-formed and unused, else make one
const ID_RE = /^[a-z0-9]{3,20}$/i;
const newId = async (Model, wanted) => (isStr(wanted) && ID_RE.test(wanted) && !(await Model.exists({ id: wanted })) ? wanted : uid());

// strip fields clients must never overwrite
const clean = (body, extra = []) => {
  const o = { ...body };
  for (const k of ["_id", "__v", "id", ...extra]) delete o[k];
  return o;
};

/* ---------- bootstrap (everything the UI needs in one call) ---------- */
r.get("/bootstrap", wrap(async (_req, res) => {
  const [users, projects, sprints, issues] = await Promise.all([
    User.find(), Project.find(), Sprint.find(), Issue.find().sort({ order: 1 }),
  ]);
  res.json({ users, projects, sprints, issues });
}));

r.post("/reset", wrap(async (_req, res) => {
  if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO !== "true") return res.status(403).json({ error: "Reset is disabled in production" });
  await seedData();
  res.json({ ok: true });
}));

/* ---------- users ---------- */

/* ---------- projects ---------- */
r.get("/projects", wrap(async (_req, res) => res.json(await Project.find())));

r.post("/projects", wrap(async (req, res) => {
  const key = text(req.body.key, "Project key", { required: true }).toUpperCase();
  const name = text(req.body.name, "Project name", { required: true, max: 100 });
  if (!KEY_RE.test(key)) throw bad("Project key must be 2-6 letters");
  if (await Project.exists({ key })) return res.status(409).json({ error: "Project key already exists" });
  const p = await Project.create({
    ...pick(req.body, ["description", "lead", "starred", "members"]),
    id: await newId(Project, req.body.id), key, name, counter: 0,
  });
  res.status(201).json(p);
}));

r.patch("/projects/:id", wrap(async (req, res) => {
  const patch = pick(req.body, ["name", "description", "lead", "starred", "members"]);
  if (patch.name !== undefined) patch.name = text(patch.name, "Project name", { required: true, max: 100 });
  const p = await Project.findOneAndUpdate({ id: req.params.id }, patch, { new: true, runValidators: true });
  if (!p) throw notFound("Project");
  res.json(p);
}));

r.delete("/projects/:id", wrap(async (req, res) => {
  const p = await Project.findOneAndDelete({ id: req.params.id });
  if (!p) throw notFound("Project");
  await Promise.all([Issue.deleteMany({ projectId: p.id }), Sprint.deleteMany({ projectId: p.id })]);
  res.json({ ok: true });
}));

/* ---------- sprints ---------- */
r.get("/sprints", wrap(async (req, res) => {
  res.json(await Sprint.find(req.query.projectId ? { projectId: req.query.projectId } : {}));
}));

r.post("/sprints", wrap(async (req, res) => {
  const projectId = String(req.body.projectId || "");
  const p = await Project.findOne({ id: projectId });
  if (!p) throw notFound("Project");
  const n = (await Sprint.countDocuments({ projectId })) + 1;
  const s = await Sprint.create({ id: await newId(Sprint, req.body.id), projectId, name: text(req.body.name, "Sprint name", { max: 100 }) || `${p.key} Sprint ${n}` });
  res.status(201).json(s);
}));

r.patch("/sprints/:id", wrap(async (req, res) => {
  // state only changes through /start and /complete
  const patch = pick(req.body, ["name", "goal", "start", "end"]);
  if (patch.name !== undefined) patch.name = text(patch.name, "Sprint name", { required: true, max: 100 });
  if (patch.goal !== undefined) patch.goal = text(patch.goal, "Goal", { max: 500 });
  patch.start = dateField(patch.start, "Start date");
  patch.end = dateField(patch.end, "End date");
  if (patch.start === undefined) delete patch.start;
  if (patch.end === undefined) delete patch.end;
  if (patch.start || patch.end) {
    const cur = await Sprint.findOne({ id: req.params.id });
    if (!cur) throw notFound("Sprint");
    const st = patch.start ?? cur.start, en = patch.end ?? cur.end;
    if (st && en && en < st) throw bad("End date must be after the start date");
  }
  const s = await Sprint.findOneAndUpdate({ id: req.params.id }, patch, { new: true, runValidators: true });
  if (!s) throw notFound("Sprint");
  res.json(s);
}));

r.post("/sprints/:id/start", wrap(async (req, res) => {
  const s = await Sprint.findOne({ id: req.params.id });
  if (!s) throw notFound("Sprint");
  if (s.state !== "future") return res.status(409).json({ error: `Only a planned sprint can be started (this one is ${s.state})` });
  if (await Sprint.exists({ projectId: s.projectId, state: "active" })) return res.status(409).json({ error: "Complete the active sprint before starting another one." });
  const { start, end } = req.body;
  if (!isValidDate(start) || !isValidDate(end)) throw bad("Start and end must be real dates (YYYY-MM-DD)");
  if (end < start) throw bad("End date must be after the start date");
  s.set({ ...pick(req.body, ["goal"]), start, end, state: "active" });
  if (req.body.name !== undefined) s.name = text(req.body.name, "Sprint name", { required: true, max: 100 });
  await s.save();
  res.json(s);
}));

r.post("/sprints/:id/complete", wrap(async (req, res) => {
  const s = await Sprint.findOne({ id: req.params.id });
  if (!s) throw notFound("Sprint");
  if (s.state !== "active") return res.status(409).json({ error: "Only an active sprint can be completed" });
  // unfinished issues go to another planned sprint of the same project (or back to the backlog)
  let moveTo = req.body.moveTo || null;
  if (moveTo) {
    const target = await Sprint.findOne({ id: String(moveTo) });
    if (!target || target.projectId !== s.projectId || target.state !== "future") throw bad("Open issues can only move to a planned sprint of this project");
  }
  s.state = "closed";
  s.end = s.end || isoDay();
  await s.save();
  await Issue.updateMany({ sprintId: s.id, status: { $ne: "Done" } }, { sprintId: moveTo });
  res.json(s);
}));

r.delete("/sprints/:id", wrap(async (req, res) => {
  const s = await Sprint.findOneAndDelete({ id: req.params.id });
  if (!s) throw notFound("Sprint");
  await Issue.updateMany({ sprintId: s.id }, { sprintId: null });
  res.json({ ok: true });
}));

/* ---------- issues ---------- */
// GET /issues
//   no paging params  -> plain array (filters only; what the UI / older clients use)
//   page | limit | q | sort -> { items, total, page, limit, pages } with server-side search + sorting
const SORTS = { order: "order", created: "createdAt", number: "num", summary: "summary", priority: "priority", status: "status" };
r.get("/issues", wrap(async (req, res) => {
  const q = {};
  for (const k of ["projectId", "sprintId", "status", "assigneeId", "epicId", "type", "priority"]) {
    if (req.query[k] === undefined || req.query[k] === "") continue;
    if (!isStr(req.query[k])) throw bad(`Invalid ${k}`); // blocks ?status[$ne]=x operator injection
    q[k] = req.query[k];
  }
  const paged = ["page", "limit", "q", "sort", "dir"].some((k) => req.query[k] !== undefined);
  if (!paged) return res.json(await Issue.find(q).sort({ order: 1 }));

  const search = isStr(req.query.q) ? req.query.q.trim().slice(0, 80) : "";
  if (search) {
    const m = /^([A-Za-z]{2,6})-(\d+)$/.exec(search); // "WEB-12" -> project key + issue number
    if (m) {
      const p = await Project.findOne({ key: m[1].toUpperCase() });
      q.projectId = q.projectId && q.projectId !== p?.id ? "__none__" : p?.id || "__none__";
      q.num = Number(m[2]);
    } else q.summary = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const sortKey = SORTS[req.query.sort] || "order";
  const dir = req.query.dir === "desc" ? -1 : 1;
  const [total, items] = await Promise.all([
    Issue.countDocuments(q),
    Issue.find(q).sort({ [sortKey]: dir, id: 1 }).skip((page - 1) * limit).limit(limit), // `id` tie-breaker keeps pages stable
  ]);
  res.json({ items, total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) });
}));

r.get("/issues/:id", wrap(async (req, res) => {
  const i = await Issue.findOne({ id: req.params.id });
  if (!i) throw notFound("Issue");
  res.json(i);
}));

r.post("/issues", wrap(async (req, res) => {
  const summary = text(req.body.summary, "Summary", { required: true, max: 255 });
  const projectId = text(req.body.projectId, "projectId", { required: true });
  if (!(await Project.exists({ id: projectId }))) throw notFound("Project");
  await checkLinks(projectId, req.body);
  const dueDate = dateField(req.body.dueDate, "Due date"), startDate = dateField(req.body.startDate, "Start date");
  const status = req.body.status || "To Do";
  const doc = new Issue({
    ...clean(req.body, ["num", "comments", "createdAt", "doneAt", "order", "reporterId"]),
    summary, projectId,
    ...(dueDate !== undefined && { dueDate }), ...(startDate !== undefined && { startDate }),
    reporterId: req.user.id,
    id: await newId(Issue, req.body.id),
    num: 0,
    createdAt: Date.now(),
    doneAt: status === "Done" ? Date.now() : null,
    order: Date.now(),
  });
  await doc.validate(); // reject bad input BEFORE using up an issue number
  // atomic per-project counter -> WEB-1, WEB-2 ...
  const p = await Project.findOneAndUpdate({ id: projectId }, { $inc: { counter: 1 } }, { new: true });
  doc.num = p.counter;
  await doc.save();
  res.status(201).json(doc);
}));

r.patch("/issues/:id", wrap(async (req, res) => {
  const issue = await Issue.findOne({ id: req.params.id });
  if (!issue) throw notFound("Issue");
  const patch = clean(req.body, ["projectId", "num", "comments", "createdAt", "order", "reporterId", "doneAt"]);
  if (patch.summary !== undefined) patch.summary = text(patch.summary, "Summary", { required: true, max: 255 });
  await checkLinks(issue.projectId, patch);
  for (const [k, label] of [["dueDate", "Due date"], ["startDate", "Start date"]]) if (k in patch) patch[k] = dateField(patch[k], label);
  if (patch.epicId && patch.epicId === issue.id) throw bad("An issue cannot be its own epic");
  if (patch.status && patch.status !== issue.status) patch.doneAt = patch.status === "Done" ? Date.now() : null;
  issue.set(patch);
  await issue.save();
  res.json(issue);
}));

// drag & drop on the board: change status and position. The position is computed only among issues of the
// SAME project and TARGET status; `beforeId` must be one of them (else 400). No beforeId = bottom of the column.
r.put("/issues/:id/move", wrap(async (req, res) => {
  const { status, beforeId } = req.body || {};
  if (!Issue.schema.path("status").enumValues.includes(status)) throw bad("Invalid status");
  const issue = await Issue.findOne({ id: req.params.id });
  if (!issue) throw notFound("Issue");
  const column = { projectId: issue.projectId, status, id: { $ne: issue.id } };

  let before = null;
  if (beforeId !== undefined && beforeId !== null && beforeId !== "") {
    if (!isStr(beforeId)) throw bad("Invalid beforeId");
    if (beforeId === issue.id) throw bad("An issue cannot be placed before itself");
    before = await Issue.findOne({ ...column, id: beforeId });
    if (!before) throw bad("beforeId must be an issue of the same project in the target column");
  }
  const place = async () => {
    if (before) {
      const prev = await Issue.findOne({ ...column, order: { $lt: before.order } }).sort({ order: -1 });
      return { prev, order: prev ? (prev.order + before.order) / 2 : before.order - 1 };
    }
    const last = await Issue.findOne(column).sort({ order: -1 });
    return { prev: last, order: (last?.order ?? 0) + 1 };
  };
  let { prev, order } = await place();
  // repeated halving can run out of float precision: renumber the column once, then place again
  if (before && prev && !(order > prev.order && order < before.order)) {
    const col = await Issue.find(column).sort({ order: 1 });
    await Promise.all(col.map((c, i) => Issue.updateOne({ id: c.id }, { order: (i + 1) * 1000 })));
    before = await Issue.findOne({ id: before.id });
    ({ order } = await place());
  }
  issue.status = status;
  issue.doneAt = status === "Done" ? issue.doneAt || Date.now() : null;
  issue.order = order;
  await issue.save();
  res.json(issue);
}));

r.delete("/issues/:id", wrap(async (req, res) => {
  const i = await Issue.findOneAndDelete({ id: req.params.id });
  if (!i) throw notFound("Issue");
  await Issue.updateMany({ epicId: i.id }, { epicId: null }); // unlink children of a deleted epic
  res.json({ ok: true });
}));

/* ---------- comments ---------- */
r.post("/issues/:id/comments", wrap(async (req, res) => {
  const { text } = req.body || {};
  const userId = req.user.id;
  if (!isStr(text) || !text.trim()) return res.status(400).json({ error: "text is required" });
  if (text.length > 5000) return res.status(400).json({ error: "Comment is too long (max 5000 characters)" });
  const comment = { id: isStr(req.body.id) && ID_RE.test(req.body.id) ? req.body.id : uid(), userId, text: text.trim(), at: Date.now() };
  const i = await Issue.findOneAndUpdate({ id: req.params.id }, { $push: { comments: comment } }, { new: true });
  if (!i) throw notFound("Issue");
  res.status(201).json(comment);
}));

r.delete("/issues/:id/comments/:commentId", wrap(async (req, res) => {
  const issue = await Issue.findOne({ id: req.params.id });
  if (!issue) throw notFound("Issue");
  const c = issue.comments.find((x) => x.id === req.params.commentId);
  if (!c) throw notFound("Comment");
  if (c.userId !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "You can only delete your own comments" });
  await Issue.updateOne({ id: issue.id }, { $pull: { comments: { id: c.id } } });
  res.json({ ok: true });
}));

export default r;
