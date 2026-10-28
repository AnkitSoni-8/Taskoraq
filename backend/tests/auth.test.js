import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, PASSWORD } from "./helpers.js";

let t;
beforeAll(async () => { t = await boot(); });
afterAll(() => t.stop());
beforeEach(() => t.reset());

describe("login", () => {
  it("returns a token and never leaks the password hash", async () => {
    const r = await t.request.post("/api/auth/login").send({ email: "admin@test.com", password: PASSWORD });
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTruthy();
    expect(r.body.user.role).toBe("admin");
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash/);
  });
  it("rejects a wrong password and an unknown email with the same message", async () => {
    const a = await t.request.post("/api/auth/login").send({ email: "admin@test.com", password: "nope-nope" });
    const b = await t.request.post("/api/auth/login").send({ email: "ghost@test.com", password: "nope-nope" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toBe(b.body.error);
  });
  it("validates input types (no NoSQL-style objects)", async () => {
    const r = await t.request.post("/api/auth/login").send({ email: { $gt: "" }, password: { $gt: "" } });
    expect(r.status).toBe(400);
  });
  it("API needs a valid token", async () => {
    expect((await t.request.get("/api/bootstrap")).status).toBe(401);
    expect((await t.request.get("/api/bootstrap").set("Authorization", "Bearer garbage")).status).toBe(401);
    expect((await t.request.get("/api/bootstrap").set(t.h("viewer"))).status).toBe(200);
  });
  it("a token stops working once the user is deleted", async () => {
    await t.M.User.deleteOne({ id: "uv" });
    expect((await t.request.get("/api/bootstrap").set(t.h("viewer"))).status).toBe(401);
  });
});

describe("registration security (P0: no accidental admin)", () => {
  const body = { name: "New Person", email: "new@test.com", password: "secret123" };

  it("creates a viewer", async () => {
    const r = await t.request.post("/api/auth/register").send(body);
    expect(r.status).toBe(201);
    expect(r.body.user.role).toBe("viewer");
  });
  it("the FIRST user on an empty database is still a viewer, not admin", async () => {
    await t.reset({ users: false });
    expect(await t.M.User.countDocuments()).toBe(0);
    const r = await t.request.post("/api/auth/register").send(body);
    expect(r.status).toBe(201);
    expect(r.body.user.role).toBe("viewer");
  });
  it("ignores a role sent by the client", async () => {
    const r = await t.request.post("/api/auth/register").send({ ...body, role: "admin" });
    expect(r.body.user.role).toBe("viewer");
  });
  it("rejects duplicate email and weak / oversized passwords", async () => {
    expect((await t.request.post("/api/auth/register").send({ ...body, email: "admin@test.com" })).status).toBe(409);
    expect((await t.request.post("/api/auth/register").send({ ...body, password: "123" })).status).toBe(400);
    expect((await t.request.post("/api/auth/register").send({ ...body, password: "x".repeat(100) })).status).toBe(400);
  });
  it("invite links grant only the invited role and only to the invited email", async () => {
    const inv = await t.request.post("/api/invites").set(t.h("admin")).send({ email: "inv@test.com", role: "coadmin" });
    expect(inv.status).toBe(201);
    const token = inv.body.invite.token;
    const wrong = await t.request.post("/api/auth/register").send({ ...body, email: "other@test.com", inviteToken: token });
    expect(wrong.status).toBe(400);
    const ok = await t.request.post("/api/auth/register").send({ ...body, email: "inv@test.com", inviteToken: token });
    expect(ok.body.user.role).toBe("coadmin");
    const reuse = await t.request.post("/api/auth/register").send({ ...body, email: "inv@test.com", inviteToken: token });
    expect(reuse.status).toBe(409); // email is taken now
    expect((await t.request.post("/api/auth/register").send({ ...body, email: "z@test.com", inviteToken: "bogus" })).status).toBe(400);
  });
  it("only an admin can create invites", async () => {
    const r = await t.request.post("/api/invites").set(t.h("coadmin")).send({ email: "inv@test.com", role: "admin" });
    expect(r.status).toBe(403);
  });
});

describe("private admin setup", () => {
  const SECRET = "a-very-long-setup-secret-123";
  const body = { name: "Boss", email: "boss@test.com", password: "secret123", setupSecret: SECRET };

  it("is disabled (404) when no ADMIN_SETUP_SECRET is configured", async () => {
    delete process.env.ADMIN_SETUP_SECRET;
    await t.reset({ users: false });
    expect((await t.request.post("/api/auth/setup-admin").send(body)).status).toBe(404);
    expect(await t.M.User.countDocuments()).toBe(0);
  });
  it("refuses a missing or wrong secret", async () => {
    process.env.ADMIN_SETUP_SECRET = SECRET;
    await t.reset({ users: false });
    expect((await t.request.post("/api/auth/setup-admin").send({ ...body, setupSecret: "wrong-wrong-wrong-wrong" })).status).toBe(403);
    expect((await t.request.post("/api/auth/setup-admin").send({ ...body, setupSecret: undefined })).status).toBe(403);
    expect(await t.M.User.countDocuments()).toBe(0);
  });
  it("creates the first admin with the right secret, once only", async () => {
    process.env.ADMIN_SETUP_SECRET = SECRET;
    await t.reset({ users: false });
    const r = await t.request.post("/api/auth/setup-admin").send(body);
    expect(r.status).toBe(201);
    expect(r.body.user.role).toBe("admin");
    const again = await t.request.post("/api/auth/setup-admin").send({ ...body, email: "second@test.com" });
    expect(again.status).toBe(409);
    delete process.env.ADMIN_SETUP_SECRET;
  });
});
