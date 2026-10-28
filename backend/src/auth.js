import jwt from "jsonwebtoken";
import User from "./models/User.js";

const DEV_SECRET = "dev-secret-change-me";
const SECRET = process.env.JWT_SECRET || DEV_SECRET;
// never run a production server with a missing / placeholder signing key
if (process.env.NODE_ENV === "production" && (SECRET === DEV_SECRET || SECRET === "change-this-to-a-long-random-string" || SECRET.length < 32)) {
  console.error("JWT_SECRET must be set to a long random string (32+ chars) in production. Set it in backend/.env");
  process.exit(1);
}
if (SECRET === DEV_SECRET) console.warn("WARNING: JWT_SECRET is not set - using an insecure development secret. Set it in backend/.env");
export const signToken = (u) => jwt.sign({ id: u.id }, SECRET, { algorithm: "HS256", expiresIn: "7d" });

// Verifies the Bearer token and loads the *current* user (so role changes apply immediately)
export async function authenticate(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Login required" });
    const { id } = jwt.verify(token, SECRET, { algorithms: ["HS256"] });
    const user = await User.findOne({ id });
    if (!user) return res.status(401).json({ error: "User no longer exists" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Session expired, please login again" });
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ error: `Your role (${req.user?.role}) is not allowed to do this` });

// used by Socket.IO to authenticate websocket connections with the same JWT
export const verifyToken = (t) => jwt.verify(t, SECRET, { algorithms: ["HS256"] });
