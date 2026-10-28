import { Router } from "express";
import bcrypt from "bcryptjs";
import User, { ROLES } from "../models/User.js";
import Project from "../models/Project.js";
import Issue from "../models/Issue.js";
import { requireRole } from "../auth.js";
import { isStr, EMAIL_RE, PASSWORD_MAX } from "../validate.js";

const r = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const adminOnly = requireRole("admin");
const COLORS = ["#0C66E4", "#E2483D", "#22A06B", "#9F8FEF", "#E56910", "#1D7AFC", "#C9372C"];

r.get("/", wrap(async (_req, res) => res.json(await User.find())));

// --- everything below: admin only ---
r.post("/", adminOnly, wrap(async (req, res) => {
  const { name, email, password, role = "viewer" } = req.body || {};
  if (![name, email, password].every(isStr)) return res.status(400).json({ error: "Name, email and password are required" });
  if (!name.trim() || !email.trim()) return res.status(400).json({ error: "Name and email are required" });
  if (!EMAIL_RE.test(email.trim())) return res.status(400).json({ error: "Enter a valid email address" });
  if (password.length < 6 || password.length > PASSWORD_MAX) return res.status(400).json({ error: `Password must be 6-${PASSWORD_MAX} characters` });
  if (!ROLES.includes(role)) return res.status(400).json({ error: "Invalid role" });
  if (await User.exists({ email: email.toLowerCase().trim() })) return res.status(409).json({ error: "Email already registered" });
  const user = await User.create({
    id: Math.random().toString(36).slice(2, 9), name: name.trim(), email: email.trim(), role,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    passwordHash: await bcrypt.hash(password, 10),
  });
  res.status(201).json(user);
}));

r.patch("/:id", adminOnly, wrap(async (req, res) => {
  const user = await User.findOne({ id: req.params.id });
  if (!user) return res.status(404).json({ error: "User not found" });
  const { role, name, password } = req.body || {};
  if ((name !== undefined && !isStr(name)) || (password !== undefined && !isStr(password))) return res.status(400).json({ error: "Invalid name or password" });
  if (role !== undefined) {
    if (!ROLES.includes(role)) return res.status(400).json({ error: "Invalid role" });
    if (user.role === "admin" && role !== "admin" && (await User.countDocuments({ role: "admin" })) <= 1)
      return res.status(400).json({ error: "There must be at least one admin" });
    user.role = role;
  }
  if (name?.trim()) user.name = name.trim();
  if (password) {
    if (password.length < 6 || password.length > PASSWORD_MAX) return res.status(400).json({ error: `Password must be 6-${PASSWORD_MAX} characters` });
    user.passwordHash = await bcrypt.hash(password, 10);
  }
  await user.save();
  res.json(user);
}));

r.delete("/:id", adminOnly, wrap(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "You cannot delete your own account" });
  const user = await User.findOneAndDelete({ id: req.params.id });
  if (!user) return res.status(404).json({ error: "User not found" });
  await Promise.all([
    Project.updateMany({}, { $pull: { members: user.id } }),
    Issue.updateMany({ assigneeId: user.id }, { assigneeId: null }),
  ]);
  res.json({ ok: true });
}));

export default r;
