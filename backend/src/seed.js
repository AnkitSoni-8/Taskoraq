import User from "./models/User.js";
import Project from "./models/Project.js";
import Sprint from "./models/Sprint.js";
import Issue from "./models/Issue.js";
import bcrypt from "bcryptjs";

const uid = () => Math.random().toString(36).slice(2, 9);
const DAY = 86400000;
const isoDay = (o = 0) => new Date(Date.now() + o * DAY).toISOString().slice(0, 10);
export const DEMO_PASSWORD = "password123";
const DEFAULT_ROLES = { u1: "admin", u2: "coadmin", u3: "coadmin", u4: "viewer", u5: "viewer" };
const COLORS = ["#0C66E4", "#E2483D", "#22A06B", "#9F8FEF", "#E56910"];

export async function seedData() {
  const users = [
    ["u1", "Ankit Soni", "ankit@example.com"],
    ["u2", "Riya Verma", "riya@example.com"],
    ["u3", "Sahil Khan", "sahil@example.com"],
    ["u4", "Karan Mehta", "karan@example.com"],
    ["u5", "Priya Nair", "priya@example.com"],
  ].map(([id, name, email], i) => ({ id, name, email, color: COLORS[i], role: DEFAULT_ROLES[id] }));
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  users.forEach((u) => (u.passwordHash = passwordHash));

  const projects = [
    { id: "p1", key: "WEB", name: "Website Redesign", description: "Complete redesign of company website using React.", lead: "u1", starred: true, counter: 0, members: ["u1", "u2", "u3"] },
    { id: "p2", key: "CRM", name: "CRM System", description: "Customer Relationship Management dashboard.", lead: "u4", starred: false, counter: 0, members: ["u1", "u4", "u5"] },
    { id: "p3", key: "HMS", name: "Hospital Management", description: "Hospital ERP system.", lead: "u2", starred: false, counter: 0, members: ["u2", "u3", "u4", "u5"] },
  ];
  const sprints = [
    { id: "s1", projectId: "p1", name: "WEB Sprint 1", goal: "Ship the new landing page and auth", state: "active", start: isoDay(-5), end: isoDay(9) },
    { id: "s2", projectId: "p1", name: "WEB Sprint 2", goal: "", state: "future", start: "", end: "" },
    { id: "s3", projectId: "p2", name: "CRM Sprint 1", goal: "", state: "future", start: "", end: "" },
  ];

  const issues = [];
  const add = (pk, o) => {
    const p = projects.find((x) => x.key === pk);
    p.counter += 1;
    const issue = {
      id: uid(), projectId: p.id, num: p.counter, reporterId: "u1",
      createdAt: Date.now() - Math.floor(Math.random() * 6 * DAY), order: issues.length, ...o,
    };
    if (issue.status === "Done") issue.doneAt = Date.now() - Math.floor(Math.random() * 3 * DAY);
    issues.push(issue);
    return issue.id;
  };
  const e1 = add("WEB", { type: "Epic", summary: "New marketing site", status: "In Progress", startDate: isoDay(-10), dueDate: isoDay(40), description: "Everything needed to launch the new public website." });
  const e2 = add("WEB", { type: "Epic", summary: "Authentication & accounts", startDate: isoDay(5), dueDate: isoDay(60), description: "Login, signup, password reset." });
  add("WEB", { type: "Story", summary: "Design responsive landing page", status: "Done", priority: "High", points: 5, assigneeId: "u2", sprintId: "s1", epicId: e1, labels: ["design", "frontend"], description: "Hero, features, pricing and footer sections." });
  add("WEB", { type: "Story", summary: "Implement navbar with mobile menu", status: "In Review", points: 3, assigneeId: "u1", sprintId: "s1", epicId: e1, labels: ["frontend"] });
  add("WEB", { type: "Task", summary: "Set up CI pipeline", status: "In Progress", priority: "High", points: 2, assigneeId: "u3", sprintId: "s1", labels: ["devops"], dueDate: isoDay(2) });
  add("WEB", { type: "Bug", summary: "Footer links overlap on small screens", priority: "Highest", points: 1, assigneeId: "u1", sprintId: "s1", epicId: e1, labels: ["bug", "css"], dueDate: isoDay(-1) });
  add("WEB", { type: "Story", summary: "Login page UI", points: 5, assigneeId: "u2", sprintId: "s1", epicId: e2, labels: ["frontend"] });
  add("WEB", { type: "Task", summary: "Write API contract for auth", status: "Done", priority: "Low", points: 2, assigneeId: "u3", sprintId: "s1", epicId: e2 });
  add("WEB", { type: "Story", summary: "Password reset flow", points: 8, sprintId: "s2", epicId: e2 });
  add("WEB", { type: "Task", summary: "Add analytics events", priority: "Low", points: 3, sprintId: "s2" });
  add("WEB", { type: "Bug", summary: "Images not lazy-loading", priority: "Low", points: 2, labels: ["performance"] });
  add("WEB", { type: "Story", summary: "Dark mode support", priority: "Lowest", points: 5, labels: ["design"] });
  add("WEB", { type: "Task", summary: "Accessibility audit", points: 3 });
  add("CRM", { type: "Story", summary: "Customer list with filters", status: "In Progress", priority: "High", assigneeId: "u4", points: 5 });
  add("CRM", { type: "Task", summary: "Import contacts from CSV", assigneeId: "u5", points: 3 });
  add("CRM", { type: "Bug", summary: "Duplicate contacts on import", priority: "High", assigneeId: "u5", points: 2 });
  add("HMS", { type: "Story", summary: "Patient registration form", status: "Done", priority: "High", assigneeId: "u2", points: 5 });
  add("HMS", { type: "Task", summary: "Doctor schedule calendar", assigneeId: "u3", points: 8 });

  await Promise.all([User.deleteMany({}), Project.deleteMany({}), Sprint.deleteMany({}), Issue.deleteMany({})]);
  await Promise.all([User.insertMany(users), Project.insertMany(projects), Sprint.insertMany(sprints), Issue.insertMany(issues)]);
}

export async function seedIfEmpty() {
  // demo accounts share a public password, so never create them on a production server unless explicitly asked
  if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO !== "true") return;
  if ((await Project.countDocuments()) === 0) {
    await seedData();
    console.log("Database seeded with demo data");
  }
}

// Upgrade path for databases created before roles existed: give old users a role + demo password.
export async function ensureAuthFields() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO !== "true") return;
  // existing databases: rename the demo admin (was "Ankit Sharma")
  await User.updateOne({ id: "u1", name: "Ankit Sharma" }, { $set: { name: "Ankit Soni" } });
  const old = await User.find({ passwordHash: { $exists: false } }).select("+passwordHash");
  if (!old.length) return;
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const u of old) {
    u.passwordHash = hash;
    u.role = DEFAULT_ROLES[u.id] || "viewer";
    await u.save();
  }
  console.log(`Migrated ${old.length} users (password: ${DEMO_PASSWORD})`);
}
