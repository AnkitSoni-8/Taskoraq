import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, eventually, ID } from "./helpers.js";

let t;
beforeAll(async () => { t = await boot(); });
afterAll(() => t.stop());
beforeEach(() => t.reset());

const issue = { projectId: "p1", summary: "Test issue" };

describe("viewer = read only", () => {
  it("can read", async () => {
    expect((await t.request.get("/api/bootstrap").set(t.h("viewer"))).status).toBe(200);
    expect((await t.request.get("/api/issues").set(t.h("viewer"))).status).toBe(200);
  });
  it("cannot create, edit, delete or comment", async () => {
    const i = await t.request.post("/api/issues").set(t.h("admin")).send(issue);
    const id = i.body.id;
    const v = t.h("viewer");
    expect((await t.request.post("/api/issues").set(v).send(issue)).status).toBe(403);
    expect((await t.request.patch(`/api/issues/${id}`).set(v).send({ summary: "hacked" })).status).toBe(403);
    expect((await t.request.delete(`/api/issues/${id}`).set(v)).status).toBe(403);
    expect((await t.request.post(`/api/issues/${id}/comments`).set(v).send({ text: "hi" })).status).toBe(403);
    expect((await t.request.post("/api/sprints").set(v).send({ projectId: "p1" })).status).toBe(403);
    expect((await t.request.post("/api/projects").set(v).send({ key: "ABC", name: "x" })).status).toBe(403);
    expect((await t.request.get(`/api/issues/${id}`).set(v)).body.summary).toBe("Test issue");
  });
  it("cannot reach admin areas", async () => {
    const v = t.h("viewer");
    expect((await t.request.get("/api/audit").set(v)).status).toBe(403);
    expect((await t.request.post("/api/users").set(v).send({})).status).toBe(403);
    expect((await t.request.get("/api/invites").set(v)).status).toBe(403);
  });
  it("can use its own notifications", async () => {
    expect((await t.request.get("/api/notifications").set(t.h("viewer"))).status).toBe(200);
    expect((await t.request.post("/api/notifications/read-all").set(t.h("viewer"))).status).toBe(200);
  });
});

describe("co-admin", () => {
  const c = () => t.h("coadmin");
  it("can manage issues, sprints and projects", async () => {
    expect((await t.request.post("/api/issues").set(c()).send(issue)).status).toBe(201);
    expect((await t.request.post("/api/sprints").set(c()).send({ projectId: "p1" })).status).toBe(201);
    expect((await t.request.post("/api/projects").set(c()).send({ key: "CRM", name: "CRM" })).status).toBe(201);
  });
  it("cannot delete projects, reset data, manage users or read the audit log", async () => {
    expect((await t.request.delete("/api/projects/p1").set(c())).status).toBe(403);
    expect((await t.request.post("/api/reset").set(c())).status).toBe(403);
    expect((await t.request.post("/api/users").set(c()).send({ name: "x", email: "x@test.com", password: "secret123", role: "admin" })).status).toBe(403);
    expect((await t.request.patch(`/api/users/${ID.viewer}`).set(c()).send({ role: "admin" })).status).toBe(403);
    expect((await t.request.get("/api/audit").set(c())).status).toBe(403);
  });
});

describe("admin", () => {
  const a = () => t.h("admin");
  it("can add users, change roles, and a role change applies immediately", async () => {
    expect((await t.request.post("/api/issues").set(t.h("coadmin")).send(issue)).status).toBe(201);
    const r = await t.request.patch(`/api/users/${ID.coadmin}`).set(a()).send({ role: "viewer" });
    expect(r.body.role).toBe("viewer");
    expect((await t.request.post("/api/issues").set(t.h("coadmin")).send(issue)).status).toBe(403); // same old token
    const u = await t.request.post("/api/users").set(a()).send({ name: "N", email: "n@test.com", password: "secret123", role: "coadmin" });
    expect(u.status).toBe(201);
    expect(JSON.stringify(u.body)).not.toMatch(/passwordHash/);
  });
  it("cannot demote the last admin or delete themselves", async () => {
    expect((await t.request.patch(`/api/users/${ID.admin}`).set(a()).send({ role: "viewer" })).status).toBe(400);
    expect((await t.request.delete(`/api/users/${ID.admin}`).set(a())).status).toBe(400);
  });
  it("deleting a project removes its issues and sprints", async () => {
    await t.request.post("/api/issues").set(a()).send(issue);
    await t.request.post("/api/sprints").set(a()).send({ projectId: "p1" });
    expect((await t.request.delete("/api/projects/p1").set(a())).status).toBe(200);
    expect(await t.M.Issue.countDocuments()).toBe(0);
    expect(await t.M.Sprint.countDocuments()).toBe(0);
  });
  it("writes an audit trail", async () => {
    await t.request.post("/api/issues").set(t.h("coadmin")).send(issue);
    const row = await eventually(async () => (await t.request.get("/api/audit").set(a())).body.find((x) => x.summary.startsWith("create issues")));
    expect(row.userId).toBe(ID.coadmin);
    expect(row.role).toBe("coadmin");
  });
  it("reset is blocked in production (it would wipe users and create public demo accounts)", async () => {
    const before = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const r = await t.request.post("/api/reset").set(a());
      expect(r.status).toBe(403);
      expect(await t.M.User.countDocuments()).toBe(3);
    } finally { process.env.NODE_ENV = before; }
  });
});
