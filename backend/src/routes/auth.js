import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import User from "../models/User.js";
import Invite from "../models/Invite.js";
import { authenticate, signToken } from "../auth.js";
import { isStr, bad, EMAIL_RE, PASSWORD_MAX, rateLimit } from "../validate.js";

const r = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const COLORS = ["#0C66E4", "#E2483D", "#22A06B", "#9F8FEF", "#E56910", "#1D7AFC", "#C9372C"];

// slow down brute-force guessing (per IP)
const loginLimit = rateLimit({ bucket: "login", limit: 20, message: "Too many login attempts, please try again in 15 minutes" });
const registerLimit = rateLimit({ bucket: "register", limit: 10, windowMs: 60 * 60 * 1000, message: "Too many sign-ups from this address, try again later" });
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10); // keeps timing equal for unknown emails

r.post("/login", loginLimit, wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!isStr(email) || !isStr(password) || !email.trim() || !password) return res.status(400).json({ error: "Email and password are required" });
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+passwordHash");
  const ok = await bcrypt.compare(password.slice(0, 200), user?.passwordHash || DUMMY_HASH);
  if (!user?.passwordHash || !ok) return res.status(401).json({ error: "Invalid email or password" });
  res.json({ token: signToken(user), user });
}));

function checkSignup(body) {
  const { name, email, password } = body || {};
  if (![name, email, password].every(isStr)) throw bad("Name, email and password are required");
  if (!name.trim() || !email.trim()) throw bad("Name and email are required");
  if (name.trim().length > 80) throw bad("Name is too long");
  if (!EMAIL_RE.test(email.trim())) throw bad("Enter a valid email address");
  if (password.length < 6) throw bad("Password must be at least 6 characters");
  if (password.length > PASSWORD_MAX) throw bad(`Password must be at most ${PASSWORD_MAX} characters`);
  return { name: name.trim(), email: email.trim(), password };
}
async function makeUser({ name, email, password }, role) {
  return User.create({
    id: Math.random().toString(36).slice(2, 9), name, email, role,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    passwordHash: await bcrypt.hash(password, 10),
  });
}

// Public sign-up ALWAYS creates a viewer (or the role of a valid email invite). Nobody can become
// admin through this route - not even the first user. Admins come from /setup-admin, the
// create-admin script, or promotion by an existing admin.
r.post("/register", registerLimit, wrap(async (req, res) => {
  const f = checkSignup(req.body);
  if (await User.exists({ email: f.email.toLowerCase() })) return res.status(409).json({ error: "Email already registered" });
  const inv = req.body.inviteToken ? await Invite.findOne({ token: String(req.body.inviteToken), used: false, expiresAt: { $gt: Date.now() } }) : null;
  if (req.body.inviteToken && !inv) return res.status(400).json({ error: "This invite link is invalid or expired" });
  if (inv && inv.email !== f.email.toLowerCase()) return res.status(400).json({ error: `This invite is for ${inv.email}` });
  const user = await makeUser(f, inv ? inv.role : "viewer");
  if (inv) { inv.used = true; await inv.save(); }
  res.status(201).json({ token: signToken(user), user });
}));

// One-time private bootstrap of the FIRST admin on an empty production database.
// Needs ADMIN_SETUP_SECRET (16+ chars) in backend/.env; refuses once any admin exists.
const setupLimit = rateLimit({ bucket: "setup", limit: 5, windowMs: 60 * 60 * 1000, message: "Too many setup attempts, try again later" });
const digest = (v) => crypto.createHash("sha256").update(String(v)).digest();
r.post("/setup-admin", setupLimit, wrap(async (req, res) => {
  const secret = process.env.ADMIN_SETUP_SECRET;
  if (!secret || secret.length < 16) return res.status(404).json({ error: "Not found" }); // feature disabled
  const f = checkSignup(req.body);
  if (!isStr(req.body.setupSecret) || !crypto.timingSafeEqual(digest(req.body.setupSecret), digest(secret))) return res.status(403).json({ error: "Invalid setup secret" });
  if (await User.exists({ role: "admin" })) return res.status(409).json({ error: "An admin already exists. Ask an existing admin to promote you." });
  if (await User.exists({ email: f.email.toLowerCase() })) return res.status(409).json({ error: "Email already registered" });
  const user = await makeUser(f, "admin");
  res.status(201).json({ token: signToken(user), user });
}));

r.get("/invite/:token", wrap(async (req, res) => {
  const inv = await Invite.findOne({ token: req.params.token, used: false, expiresAt: { $gt: Date.now() } });
  if (!inv) return res.status(404).json({ error: "This invite link is invalid or expired" });
  res.json({ email: inv.email, role: inv.role });
}));

r.get("/me", authenticate, (req, res) => res.json({ user: req.user }));

export default r;
