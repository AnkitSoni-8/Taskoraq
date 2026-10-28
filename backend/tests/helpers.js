// Boots the real Express app against a throw-away in-memory MongoDB (no mocks).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import supertest from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-".repeat(4);
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "taskoraq-uploads-"));
delete process.env.ADMIN_SETUP_SECRET;

export const PASSWORD = "Passw0rd!";
export const ID = { admin: "ua", coadmin: "uc", viewer: "uv" };

export async function boot() {
  // TEST_MONGO_URI = use an already running MongoDB (e.g. in CI / offline) instead of downloading an in-memory binary
  const mem = process.env.TEST_MONGO_URI ? null : await MongoMemoryServer.create();
  await mongoose.connect(process.env.TEST_MONGO_URI || mem.getUri("taskoraq-test"));
  const app = (await import("../src/app.js")).default;
  const M = {
    User: (await import("../src/models/User.js")).default,
    Project: (await import("../src/models/Project.js")).default,
    Sprint: (await import("../src/models/Sprint.js")).default,
    Issue: (await import("../src/models/Issue.js")).default,
  };
  const { signToken } = await import("../src/auth.js");
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  const tokens = Object.fromEntries(Object.entries(ID).map(([role, id]) => [role, signToken({ id })]));

  // clean slate + 3 users (admin / coadmin / viewer) + project WEB
  async function reset({ users = true } = {}) {
    for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({});
    if (users) {
      await M.User.insertMany(Object.entries(ID).map(([role, id]) => ({ id, name: role, email: `${role}@test.com`, role, passwordHash })));
    }
    await M.Project.create({ id: "p1", key: "WEB", name: "Website", lead: ID.admin, members: Object.values(ID) });
  }
  const h = (role) => ({ Authorization: `Bearer ${tokens[role]}` });
  const stop = async () => { await mongoose.disconnect(); await mem?.stop(); };
  return { app, request: supertest(app), M, tokens, h, reset, stop, uploadDir: process.env.UPLOAD_DIR };
}

// audit log + notifications are written after the response is sent: wait for them
export async function eventually(fn, ms = 3000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
}
