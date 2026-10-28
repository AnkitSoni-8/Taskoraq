import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot } from "./helpers.js";

let t;
beforeAll(async () => { t = await boot(); });
afterAll(() => t.stop());
beforeEach(() => t.reset());

const c = () => t.h("coadmin");
const newSprint = async (projectId = "p1") => (await t.request.post("/api/sprints").set(c()).send({ projectId })).body;
const start = (id, body = { start: "2026-01-01", end: "2026-01-14" }) => t.request.post(`/api/sprints/${id}/start`).set(c()).send(body);
const newIssue = async (extra) => (await t.request.post("/api/issues").set(c()).send({ projectId: "p1", summary: "i", ...extra })).body;

describe("sprint lifecycle: future -> active -> closed", () => {
  it("is created as a planned (future) sprint", async () => {
    const s = await newSprint();
    expect(s.state).toBe("future");
    expect(s.name).toBe("WEB Sprint 1");
  });
  it("starting needs valid dates", async () => {
    const s = await newSprint();
    expect((await start(s.id, {})).status).toBe(400);
    expect((await start(s.id, { start: "2026-02-01", end: "2026-01-01" })).status).toBe(400);
    expect((await start(s.id, { start: "tomorrow", end: "later" })).status).toBe(400);
    const ok = await start(s.id);
    expect(ok.status).toBe(200);
    expect(ok.body.state).toBe("active");
  });
  it("only one active sprint per project, and only a planned sprint can start", async () => {
    const a = await newSprint(), b = await newSprint();
    await start(a.id);
    expect((await start(b.id)).status).toBe(409);
    expect((await start(a.id)).status).toBe(409);
  });
  it("state cannot be forced through PATCH", async () => {
    const s = await newSprint();
    const r = await t.request.patch(`/api/sprints/${s.id}`).set(c()).send({ state: "closed", name: "Renamed" });
    expect(r.body.state).toBe("future");
    expect(r.body.name).toBe("Renamed");
  });
  it("completing keeps Done issues and sends open ones to the backlog", async () => {
    const s = await newSprint();
    const open = await newIssue({ sprintId: s.id });
    const done = await newIssue({ sprintId: s.id, status: "Done" });
    await start(s.id);
    const r = await t.request.post(`/api/sprints/${s.id}/complete`).set(c()).send({});
    expect(r.body.state).toBe("closed");
    expect((await t.M.Issue.findOne({ id: open.id })).sprintId).toBeNull();
    expect((await t.M.Issue.findOne({ id: done.id })).sprintId).toBe(s.id);
  });
  it("completing can move open issues into the next planned sprint", async () => {
    const a = await newSprint(), b = await newSprint();
    const open = await newIssue({ sprintId: a.id });
    await start(a.id);
    const r = await t.request.post(`/api/sprints/${a.id}/complete`).set(c()).send({ moveTo: b.id });
    expect(r.status).toBe(200);
    expect((await t.M.Issue.findOne({ id: open.id })).sprintId).toBe(b.id);
  });
  it("rejects invalid move targets and completing a non-active sprint", async () => {
    const a = await newSprint(), b = await newSprint();
    expect((await t.request.post(`/api/sprints/${a.id}/complete`).set(c()).send({})).status).toBe(409);
    await t.M.Project.create({ id: "p2", key: "CRM", name: "CRM" });
    const other = await newSprint("p2");
    await start(a.id);
    expect((await t.request.post(`/api/sprints/${a.id}/complete`).set(c()).send({ moveTo: other.id })).status).toBe(400);
    await start(b.id).then((r) => expect(r.status).toBe(409)); // a still active
    expect((await t.request.post(`/api/sprints/${a.id}/complete`).set(c()).send({ moveTo: "ghost" })).status).toBe(400);
  });
  it("deleting a sprint returns its issues to the backlog", async () => {
    const s = await newSprint();
    const i = await newIssue({ sprintId: s.id });
    expect((await t.request.delete(`/api/sprints/${s.id}`).set(c())).status).toBe(200);
    expect((await t.M.Issue.findOne({ id: i.id })).sprintId).toBeNull();
  });
});

describe("sprint dates must be real calendar dates", () => {
  it.each([
    ["2026-02-30", "2026-03-10"], // 30 Feb
    ["2026-13-01", "2026-14-01"], // month 13
    ["2026-04-31", "2026-05-10"], // April has 30 days
    ["2025-02-29", "2025-03-10"], // 2025 is not a leap year
    ["2026-00-10", "2026-01-10"], // month 0
    ["2026-01-00", "2026-01-10"], // day 0
  ])("start rejects %s -> %s", async (a, b) => {
    const s = await newSprint();
    expect((await start(s.id, { start: a, end: b })).status).toBe(400);
  });
  it("accepts a leap day and same-day (start == end) boundaries", async () => {
    const a = await newSprint();
    expect((await start(a.id, { start: "2024-02-29", end: "2024-02-29" })).status).toBe(200);
  });
  it("end one day before start is rejected, end == start is fine", async () => {
    const s = await newSprint();
    expect((await start(s.id, { start: "2026-03-01", end: "2026-02-28" })).status).toBe(400);
    expect((await start(s.id, { start: "2026-03-01", end: "2026-03-01" })).status).toBe(200);
  });
  it("PATCH validates dates too (and start/end order against the stored value)", async () => {
    const s = await newSprint();
    const patch = (b) => t.request.patch(`/api/sprints/${s.id}`).set(c()).send(b);
    expect((await patch({ start: "2026-02-30" })).status).toBe(400);
    expect((await patch({ start: "2026-05-01", end: "2026-05-10" })).status).toBe(200);
    expect((await patch({ end: "2026-04-30" })).status).toBe(400); // before stored start
    expect((await patch({ end: "" })).status).toBe(200); // clearing is allowed
  });
  it("issue due / start dates must be real dates", async () => {
    const bad = await t.request.post("/api/issues").set(c()).send({ projectId: "p1", summary: "x", dueDate: "2026-02-30" });
    expect(bad.status).toBe(400);
    const ok = await t.request.post("/api/issues").set(c()).send({ projectId: "p1", summary: "x", dueDate: "2028-02-29" });
    expect(ok.status).toBe(201);
    expect((await t.request.patch(`/api/issues/${ok.body.id}`).set(c()).send({ dueDate: "2027-02-29" })).status).toBe(400);
  });
});
