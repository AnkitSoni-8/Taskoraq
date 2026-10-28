import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, eventually, ID } from "./helpers.js";

let t;
beforeAll(async () => { t = await boot(); });
afterAll(() => t.stop());
beforeEach(() => t.reset());

const post = (body, role = "coadmin") => t.request.post("/api/issues").set(t.h(role)).send(body);

describe("issue creation", () => {
  it("numbers issues per project and records the real reporter", async () => {
    const a = await post({ projectId: "p1", summary: "First" });
    const b = await post({ projectId: "p1", summary: "Second" });
    expect(a.status).toBe(201);
    expect([a.body.num, b.body.num]).toEqual([1, 2]);
    expect(a.body.reporterId).toBe(ID.coadmin);
    expect(a.body.status).toBe("To Do");
  });
  it("client cannot forge number, reporter or timestamps", async () => {
    const r = await post({ projectId: "p1", summary: "x", num: 99, reporterId: "someone-else", createdAt: 1, comments: [{ text: "fake" }] });
    expect(r.body.num).toBe(1);
    expect(r.body.reporterId).toBe(ID.coadmin);
    expect(r.body.createdAt).toBeGreaterThan(1);
    expect(r.body.comments).toEqual([]);
  });
  it("validates input and does not burn an issue number on bad input", async () => {
    expect((await post({ projectId: "p1" })).status).toBe(400);
    expect((await post({ projectId: "p1", summary: "x", type: "Nope" })).status).toBe(400);
    expect((await post({ projectId: "p1", summary: { a: 1 } })).status).toBe(400);
    expect((await post({ projectId: "ghost", summary: "x" })).status).toBe(404);
    expect((await post({ projectId: "p1", summary: "ok" })).body.num).toBe(1);
  });
  it("parallel creates still get unique numbers", async () => {
    const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => post({ projectId: "p1", summary: `n${i}` })));
    expect(new Set(rs.map((r) => r.body.num)).size).toBe(8);
  });
});

describe("issue updates", () => {
  it("sets doneAt when moved to Done and clears it again", async () => {
    const { body } = await post({ projectId: "p1", summary: "x" });
    const done = await t.request.patch(`/api/issues/${body.id}`).set(t.h("coadmin")).send({ status: "Done" });
    expect(done.body.doneAt).toBeTruthy();
    const back = await t.request.patch(`/api/issues/${body.id}`).set(t.h("coadmin")).send({ status: "In Progress" });
    expect(back.body.doneAt).toBeNull();
  });
  it("board move changes status", async () => {
    const { body } = await post({ projectId: "p1", summary: "x" });
    const r = await t.request.put(`/api/issues/${body.id}/move`).set(t.h("coadmin")).send({ status: "In Review" });
    expect(r.body.status).toBe("In Review");
  });
  it("cannot overwrite protected fields through PATCH", async () => {
    const { body } = await post({ projectId: "p1", summary: "x" });
    const r = await t.request.patch(`/api/issues/${body.id}`).set(t.h("coadmin")).send({ summary: "y", num: 50, projectId: "other", reporterId: "z" });
    expect(r.body.summary).toBe("y");
    expect(r.body.num).toBe(1);
    expect(r.body.projectId).toBe("p1");
    expect(r.body.reporterId).toBe(ID.coadmin);
  });
  it("comments are attributed to the logged-in user and can be removed", async () => {
    const { body } = await post({ projectId: "p1", summary: "x" });
    const c = await t.request.post(`/api/issues/${body.id}/comments`).set(t.h("coadmin")).send({ text: "hello", userId: "forged" });
    expect(c.status).toBe(201);
    expect(c.body.userId).toBe(ID.coadmin);
    const del = await t.request.delete(`/api/issues/${body.id}/comments/${c.body.id}`).set(t.h("coadmin"));
    expect(del.status).toBe(200);
    expect((await t.request.get(`/api/issues/${body.id}`).set(t.h("admin"))).body.comments).toEqual([]);
  });
});

describe("notifications", () => {
  it("assigning an issue notifies the assignee (not the actor)", async () => {
    await post({ projectId: "p1", summary: "Fix login", assigneeId: ID.viewer });
    const n = await eventually(async () => (await t.request.get("/api/notifications").set(t.h("viewer"))).body[0]);
    expect(n.text).toMatch(/assigned you/);
    expect((await t.request.get("/api/notifications").set(t.h("coadmin"))).body).toHaveLength(0);
    await t.request.post(`/api/notifications/${n.id}/read`).set(t.h("viewer"));
    expect((await t.request.get("/api/notifications").set(t.h("viewer"))).body[0].read).toBe(true);
  });
  it("users only see their own notifications", async () => {
    await post({ projectId: "p1", summary: "x", assigneeId: ID.viewer });
    await eventually(async () => (await t.request.get("/api/notifications").set(t.h("viewer"))).body[0]);
    expect((await t.request.get("/api/notifications").set(t.h("admin"))).body).toHaveLength(0);
  });
});
