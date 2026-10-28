import { Router } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { fileURLToPath } from "node:url";
import Notification from "../models/Notification.js";
import AuditLog from "../models/AuditLog.js";
import Invite from "../models/Invite.js";
import Issue from "../models/Issue.js";
import User, { ROLES } from "../models/User.js";
import { requireRole } from "../auth.js";
import { sendInviteMail } from "../mailer.js";

const r = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const staff = requireRole("admin", "coadmin");
const adminOnly = requireRole("admin");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- notifications (every logged-in user, own only) ---------- */
r.get("/notifications", wrap(async (req, res) => res.json(await Notification.find({ userId: req.user.id }).sort({ at: -1 }).limit(50))));
r.post("/notifications/read-all", wrap(async (req, res) => { await Notification.updateMany({ userId: req.user.id, read: false }, { read: true }); res.json({ ok: true }); }));
r.post("/notifications/:id/read", wrap(async (req, res) => { await Notification.updateOne({ id: req.params.id, userId: req.user.id }, { read: true }); res.json({ ok: true }); }));

/* ---------- audit log (admin) ---------- */
r.get("/audit", adminOnly, wrap(async (req, res) => {
  const q = {};
  if (req.query.entity) q.entity = String(req.query.entity);
  if (req.query.userId) q.userId = String(req.query.userId);
  res.json(await AuditLog.find(q).sort({ at: -1 }).limit(Math.min(Number(req.query.limit) || 200, 500)));
}));

/* ---------- email invites (admin) ---------- */
r.get("/invites", adminOnly, wrap(async (_req, res) => res.json(await Invite.find({ used: false, expiresAt: { $gt: Date.now() } }).sort({ at: -1 }))));
r.post("/invites", adminOnly, wrap(async (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const role = req.body.role || "viewer";
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address" });
  if (!ROLES.includes(role)) return res.status(400).json({ error: "Invalid role" });
  if (await User.exists({ email })) return res.status(409).json({ error: "This email already has an account" });
  const invite = await Invite.create({ token: crypto.randomBytes(18).toString("hex"), email, role, invitedBy: req.user.id, expiresAt: Date.now() + 7 * 864e5 });
  const origin = (process.env.CLIENT_ORIGIN || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173").split(",")[0].trim();
  const link = `${origin}/?invite=${invite.token}`;
  let emailSent = false;
  try { emailSent = await sendInviteMail({ to: email, link, role, inviter: req.user.name }); } catch (e) { console.error("mail:", e.message); }
  res.status(201).json({ invite, link, emailSent });
}));
r.delete("/invites/:token", adminOnly, wrap(async (req, res) => { await Invite.deleteOne({ token: req.params.token }); res.json({ ok: true }); }));

/* ---------- file upload (co-admin / admin) ---------- */
const dir = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "uploads");
fs.mkdirSync(dir, { recursive: true });
export const uploadDir = dir;
const BLOCKED = /\.(exe|bat|cmd|sh|js|mjs|html?|svg|php|msi|com|scr|jar)$/i; // never serve executable/script-like files
const upload = multer({
  storage: multer.diskStorage({
    destination: dir,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(12).toString("hex") + path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 8)),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => (BLOCKED.test(file.originalname) ? cb(Object.assign(new Error("This file type is not allowed"), { status: 400 })) : cb(null, true)),
});

r.post("/issues/:id/attachments", staff, upload.single("file"), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file received" });
  const att = { id: crypto.randomBytes(5).toString("hex"), name: req.file.originalname.slice(0, 120), url: `/api/uploads/${req.file.filename}`, size: req.file.size, mime: req.file.mimetype, by: req.user.id, at: Date.now() };
  const issue = await Issue.findOneAndUpdate({ id: req.params.id }, { $push: { attachments: att } }, { new: true });
  if (!issue) { await fs.promises.unlink(req.file.path).catch(() => {}); return res.status(404).json({ error: "Issue not found" }); }
  res.status(201).json(att);
}));
r.delete("/issues/:id/attachments/:attId", staff, wrap(async (req, res) => {
  const issue = await Issue.findOneAndUpdate({ id: req.params.id }, { $pull: { attachments: { id: req.params.attId } } });
  const att = issue?.attachments.find((a) => a.id === req.params.attId);
  if (att) await fs.promises.unlink(path.join(dir, path.basename(att.url))).catch(() => {});
  res.json({ ok: true });
}));

// Downloads need a valid login (this router sits behind authenticate) and the file must belong to a
// real attachment. Same read rule as the issue itself: any signed-in user. Never a public static folder.
const FILE_RE = /^[a-f0-9]{24}(\.[a-z0-9]{1,7})?$/;
r.get("/uploads/:name", wrap(async (req, res) => {
  const { name } = req.params;
  if (!FILE_RE.test(name)) return res.status(404).json({ error: "File not found" });
  const url = `/api/uploads/${name}`;
  const issue = await Issue.findOne({ "attachments.url": url });
  const att = issue?.attachments.find((a) => a.url === url);
  if (!att) return res.status(404).json({ error: "File not found" });
  const safeName = encodeURIComponent(att.name).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  res.set({
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename*=UTF-8''${safeName}`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox",
    "Cache-Control": "private, no-store",
  });
  res.sendFile(path.join(dir, name), { dotfiles: "deny" }, (err) => { if (err && !res.headersSent) res.status(404).json({ error: "File not found" }); });
}));

export default r;
