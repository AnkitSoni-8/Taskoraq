import mongoose from "mongoose";

// Small input-validation + rate-limit helpers (no extra dependencies).
export const isStr = (v) => typeof v === "string";
export const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
// a real calendar date in YYYY-MM-DD (rejects 2026-02-30, 2026-13-01, 2025-02-29; accepts 2024-02-29)
export function isValidDate(v) {
  if (!isStr(v) || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 && dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MAX = 72; // bcrypt only uses the first 72 bytes

// Rate limiter stored in MongoDB (shared by every server instance, survives restarts, no extra dependency).
// One counter document per (bucket, IP, time window); a TTL index deletes old windows automatically.
const Hit = mongoose.model(
  "RateLimit",
  new mongoose.Schema({ _id: String, n: { type: Number, default: 0 }, expireAt: { type: Date, index: { expires: 0 } } }, { versionKey: false })
);

export function rateLimit({ bucket, limit = 10, windowMs = 15 * 60 * 1000, message = "Too many attempts, try again later" } = {}) {
  return async (req, res, next) => {
    try {
      const now = Date.now();
      const win = Math.floor(now / windowMs);
      const hit = await Hit.findOneAndUpdate(
        { _id: `${bucket}:${req.ip}:${win}` },
        { $inc: { n: 1 }, $setOnInsert: { expireAt: new Date((win + 1) * windowMs) } },
        { upsert: true, new: true }
      );
      if (hit.n > limit) {
        res.set("Retry-After", String(Math.ceil(((win + 1) * windowMs - now) / 1000)));
        return res.status(429).json({ error: message });
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}
