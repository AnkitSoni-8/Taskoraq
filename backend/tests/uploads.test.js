import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot } from "./helpers.js";

let t, issueId;
beforeAll(async () => { t = await boot(); });
afterAll(() => t.stop());
beforeEach(async () => {
  await t.reset();
  for (const f of fs.readdirSync(t.uploadDir)) fs.unlinkSync(path.join(t.uploadDir, f)); // isolate tests
  issueId = (await t.request.post("/api/issues").set(t.h("coadmin")).send({ projectId: "p1", summary: "with file" })).body.id;
});

const upload = (role, name = "notes.txt", content = "hello attachment", id = () => issueId) =>
  t.request.post(`/api/issues/${id()}/attachments`).set(t.h(role)).attach("file", Buffer.from(content), name);
const nameOf = (att) => att.url.split("/").pop();

describe("upload", () => {
  it("co-admin can upload; the file lands in the upload dir under a random name", async () => {
    const r = await upload("coadmin");
    expect(r.status).toBe(201);
    expect(r.body.url).toMatch(/^\/api\/uploads\/[a-f0-9]{24}\.txt$/);
    expect(r.body.name).toBe("notes.txt");
    expect(fs.existsSync(path.join(t.uploadDir, nameOf(r.body)))).toBe(true);
    expect((await t.M.Issue.findOne({ id: issueId })).attachments).toHaveLength(1);
  });
  it("viewer cannot upload; anonymous cannot upload", async () => {
    expect((await upload("viewer")).status).toBe(403);
    const anon = await t.request.post(`/api/issues/${issueId}/attachments`).attach("file", Buffer.from("x"), "a.txt");
    expect(anon.status).toBe(401);
  });
  it("blocks executable / script-like files and oversized files", async () => {
    for (const n of ["evil.exe", "page.html", "x.js", "pic.svg"]) expect((await upload("coadmin", n)).status).toBe(400);
    const big = await upload("coadmin", "big.bin", Buffer.alloc(5 * 1024 * 1024 + 10));
    expect(big.status).toBe(413);
    expect(fs.readdirSync(t.uploadDir).filter((f) => !f.startsWith("."))).toHaveLength(0);
  });
  it("404 for an unknown issue and removes the stray file", async () => {
    const r = await t.request.post("/api/issues/ghost/attachments").set(t.h("coadmin")).attach("file", Buffer.from("x"), "a.txt");
    expect(r.status).toBe(404);
    expect(fs.readdirSync(t.uploadDir)).toHaveLength(0);
  });
  it("odd extensions are sanitised and the file is still downloadable", async () => {
    const r = await upload("coadmin", "report.p-n!g");
    expect(r.status).toBe(201);
    expect((await t.request.get(r.body.url).set(t.h("viewer"))).status).toBe(200);
  });
});

describe("download (P0: login required)", () => {
  it("anonymous requests get 401 - there is no public static folder", async () => {
    const { body } = await upload("coadmin");
    expect((await t.request.get(body.url)).status).toBe(401);
    expect((await t.request.get(body.url).set("Authorization", "Bearer garbage")).status).toBe(401);
  });
  it("any signed-in user can download, as a forced attachment with safe headers", async () => {
    const { body } = await upload("coadmin", "my file (1).txt", "secret-content");
    for (const role of ["viewer", "coadmin", "admin"]) {
      const r = await t.request.get(body.url).set(t.h(role));
      expect(r.status).toBe(200);
      expect(Buffer.from(r.body).toString()).toBe("secret-content");
      expect(r.headers["content-disposition"]).toMatch(/^attachment; filename\*=UTF-8''my%20file%20%281%29\.txt$/);
      expect(r.headers["content-type"]).toBe("application/octet-stream");
      expect(r.headers["x-content-type-options"]).toBe("nosniff");
      expect(r.headers["cache-control"]).toMatch(/no-store/);
    }
  });
  it("a deleted user's token cannot download", async () => {
    const { body } = await upload("coadmin");
    await t.M.User.deleteOne({ id: "uv" });
    expect((await t.request.get(body.url).set(t.h("viewer"))).status).toBe(401);
  });
  it("404 for unknown names, path traversal and files with no attachment record", async () => {
    const v = t.h("viewer");
    expect((await t.request.get("/api/uploads/aaaaaaaaaaaaaaaaaaaaaaaa.txt").set(v)).status).toBe(404);
    expect((await t.request.get("/api/uploads/..%2f..%2fpackage.json").set(v)).status).toBe(404);
    expect((await t.request.get("/api/uploads/%2e%2e%2f.env").set(v)).status).toBe(404);
    fs.writeFileSync(path.join(t.uploadDir, "b".repeat(24) + ".txt"), "orphan");
    expect((await t.request.get(`/api/uploads/${"b".repeat(24)}.txt`).set(v)).status).toBe(404);
  });
  it("deleting an attachment removes the file and the download", async () => {
    const { body } = await upload("coadmin");
    const del = await t.request.delete(`/api/issues/${issueId}/attachments/${body.id}`).set(t.h("coadmin"));
    expect(del.status).toBe(200);
    expect(fs.existsSync(path.join(t.uploadDir, nameOf(body)))).toBe(false);
    expect((await t.request.get(body.url).set(t.h("admin"))).status).toBe(404);
    expect((await t.request.delete(`/api/issues/${issueId}/attachments/${body.id}`).set(t.h("viewer"))).status).toBe(403);
  });
});
