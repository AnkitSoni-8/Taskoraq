import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot } from "./helpers.js";

let t;
beforeAll(async () => { t = await boot(); });
afterAll(() => t.stop());
beforeEach(() => t.reset());

const c = () => t.h("coadmin");
const mk = async (summary, extra = {}) => (await t.request.post("/api/issues").set(c()).send({ projectId: "p1", summary, ...extra })).body;
const move = (id, status, beforeId) => t.request.put(`/api/issues/${id}/move`).set(c()).send({ status, beforeId });
const column = async (projectId, status) =>
  (await t.request.get(`/api/issues?projectId=${projectId}&status=${encodeURIComponent(status)}`).set(c())).body.map((i) => i.summary);

describe("drag & drop ordering (/issues/:id/move)", () => {
  it("places an issue before another one inside the same column", async () => {
    const a = await mk("a"), b = await mk("b"), d = await mk("d");
    expect((await move(d.id, "To Do", a.id)).status).toBe(200);
    expect(await column("p1", "To Do")).toEqual(["d", "a", "b"]);
    expect((await move(a.id, "To Do", b.id)).status).toBe(200); // a already sits before b: stays stable
    expect(await column("p1", "To Do")).toEqual(["d", "a", "b"]);
  });
  it("cross-column: lands in the target status at the requested position", async () => {
    const a = await mk("a"), x = await mk("x", { status: "In Progress" }), y = await mk("y", { status: "In Progress" });
    expect((await move(a.id, "In Progress", y.id)).status).toBe(200);
    expect(await column("p1", "In Progress")).toEqual(["x", "a", "y"]);
    expect(await column("p1", "To Do")).toEqual([]);
  });
  it("without beforeId it goes to the bottom of the target column; Done sets doneAt, leaving clears it", async () => {
    const a = await mk("a"), x = await mk("x", { status: "Done" });
    const r = await move(a.id, "Done");
    expect(r.body.doneAt).toBeTruthy();
    expect(await column("p1", "Done")).toEqual(["x", "a"]);
    expect((await move(a.id, "To Do")).body.doneAt).toBeNull();
  });
  it("ignores issues of OTHER projects and statuses when calculating the position", async () => {
    await t.M.Project.create({ id: "p2", key: "CRM", name: "Crm", lead: "ua", members: ["ua"] });
    const a = await mk("a");
    const other = (await t.request.post("/api/issues").set(c()).send({ projectId: "p2", summary: "other" })).body;
    const b = await mk("b");
    // force an "other project" issue to sit numerically between a and b
    await t.M.Issue.updateOne({ id: other.id }, { order: (a.order + b.order) / 2 });
    await move(b.id, "To Do", a.id);
    const [bb, aa] = await Promise.all([t.M.Issue.findOne({ id: b.id }), t.M.Issue.findOne({ id: a.id })]);
    expect(bb.order).toBeLessThan(aa.order);
    expect(await column("p1", "To Do")).toEqual(["b", "a"]);
  });
  it("rejects an invalid beforeId (unknown, other project, other column, itself)", async () => {
    await t.M.Project.create({ id: "p2", key: "CRM", name: "Crm", lead: "ua", members: ["ua"] });
    const a = await mk("a"), b = await mk("b", { status: "Done" });
    const other = (await t.request.post("/api/issues").set(c()).send({ projectId: "p2", summary: "o" })).body;
    expect((await move(a.id, "To Do", "nope")).status).toBe(400);
    expect((await move(a.id, "To Do", other.id)).status).toBe(400);
    expect((await move(a.id, "To Do", b.id)).status).toBe(400); // b is in Done
    expect((await move(a.id, "To Do", a.id)).status).toBe(400);
    expect((await move(a.id, "Nope")).status).toBe(400);
    expect((await move("missing", "Done")).status).toBe(404);
  });
  it("survives many insertions at the top of a column (float precision) and keeps the order", async () => {
    const first = await mk("first");
    const ids = [first.id];
    for (let i = 0; i < 70; i++) { const n = await mk(`n${i}`); await move(n.id, "To Do", ids[ids.length - 1]); ids.push(n.id); }
    const names = await column("p1", "To Do");
    expect(names).toHaveLength(71);
    expect(names[names.length - 1]).toBe("first");
    expect(names[0]).toBe("n69");
    expect(new Set((await t.M.Issue.find({ projectId: "p1" })).map((i) => i.order)).size).toBe(71); // all distinct
  });
  it("viewers cannot move issues", async () => {
    const a = await mk("a");
    expect((await t.request.put(`/api/issues/${a.id}/move`).set(t.h("viewer")).send({ status: "Done" })).status).toBe(403);
  });
});

describe("paginated issue listing (GET /issues?page&limit&q)", () => {
  beforeEach(async () => { for (let i = 1; i <= 25; i++) await mk(`Task number ${i}`, { priority: i % 2 ? "High" : "Low" }); });

  it("without paging params it is still a plain array (backwards compatible)", async () => {
    const r = await t.request.get("/api/issues?projectId=p1").set(c());
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body).toHaveLength(25);
  });
  it("returns items + total + pages and never repeats an issue across pages", async () => {
    const p1 = (await t.request.get("/api/issues?page=1&limit=10").set(c())).body;
    const p3 = (await t.request.get("/api/issues?page=3&limit=10").set(c())).body;
    expect(p1).toMatchObject({ total: 25, page: 1, limit: 10, pages: 3 });
    expect(p1.items).toHaveLength(10);
    expect(p3.items).toHaveLength(5);
    const all = [];
    for (const n of [1, 2, 3]) all.push(...(await t.request.get(`/api/issues?page=${n}&limit=10`).set(c())).body.items.map((i) => i.id));
    expect(new Set(all).size).toBe(25);
  });
  it("clamps limit to 1..200, bad page numbers fall back to page 1, past the end is empty", async () => {
    expect((await t.request.get("/api/issues?limit=100000").set(c())).body.limit).toBe(200);
    expect((await t.request.get("/api/issues?limit=0&page=-4").set(c())).body).toMatchObject({ limit: 50, page: 1 });
    const r = (await t.request.get("/api/issues?page=99&limit=10").set(c())).body;
    expect(r.items).toEqual([]);
    expect(r.total).toBe(25);
  });
  it("server-side search by summary (case-insensitive, regex-safe) and by key (WEB-7)", async () => {
    const s = (await t.request.get("/api/issues?q=NUMBER 2").set(c())).body;
    expect(s.total).toBe(7); // 2, 12..19 contain "number 2": 2 and 20..25 -> 7
    expect((await t.request.get("/api/issues?q=" + encodeURIComponent(".*(")).set(c())).status).toBe(200);
    const k = (await t.request.get("/api/issues?q=web-7").set(c())).body;
    expect(k.total).toBe(1);
    expect(k.items[0].summary).toBe("Task number 7");
  });
  it("combines filters + search + sorting and keeps the total in sync", async () => {
    const r = (await t.request.get("/api/issues?priority=High&sort=number&dir=desc&limit=5").set(c())).body;
    expect(r.total).toBe(13);
    expect(r.items.map((i) => i.num)).toEqual([25, 23, 21, 19, 17]);
  });
  it("rejects operator-injection style filters", async () => {
    expect((await t.request.get("/api/issues?status[$ne]=x").set(c())).status).toBe(400);
  });
  it("is fast on a large dataset (5,000 issues, one page < 1.5 s)", async () => {
    const docs = Array.from({ length: 5000 }, (_, i) => ({ id: `big${i}`, projectId: "p1", num: 1000 + i, summary: `Bulk issue ${i}`, order: i }));
    await t.M.Issue.insertMany(docs);
    const t0 = Date.now();
    const r = await t.request.get("/api/issues?projectId=p1&page=40&limit=50&q=bulk").set(c());
    const ms = Date.now() - t0;
    expect(r.body.total).toBe(5000);
    expect(r.body.items).toHaveLength(50);
    expect(ms).toBeLessThan(1500);
  });
});
