import "./env.js"; // loads backend/.env (must stay the first import)
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import apiRoutes from "./routes/index.js";

// The Express app only (no DB connection, no listen) so tests can import it. server.js starts it.
const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : process.env.TRUST_PROXY); // set when behind nginx / a load balancer
// only the configured frontend origin(s) may call the API (default: the Vite dev server)
// On Render, RENDER_EXTERNAL_URL (the service URL) is set automatically, so CLIENT_ORIGIN is optional there.
export const ORIGINS = (process.env.CLIENT_ORIGIN || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173").split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: ORIGINS }));
app.use((_req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer" });
  next();
});
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, app: "taskoraq" }));
app.use("/api", apiRoutes);

// Production: serve the built React app (dist/, created by `npm run build`) from the same server,
// so one deployment (e.g. one Render Web Service) is enough and no CORS / VITE_API_URL setup is needed.
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "dist");
if (fs.existsSync(path.join(DIST, "index.html"))) {
  app.use(express.static(DIST, { index: false, maxAge: "1h" }));
  app.get(/^\/(?!api\/|socket\.io\/)[^.]*$/, (_req, res) => res.sendFile(path.join(DIST, "index.html")));
}
app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
  // bad client input -> 4xx with a readable message (never a 500)
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Request body too large" });
  if (err.name === "ValidationError") return res.status(400).json({ error: Object.values(err.errors).map((e) => e.message).join("; ") });
  if (err.name === "MulterError") return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "File too large (max 5 MB)" : err.message });
  if (err.name === "CastError") return res.status(400).json({ error: `Invalid value for ${err.path}` });
  if (err.code === 11000) return res.status(409).json({ error: "Duplicate value - that record already exists" });
  console.error(err);
  const status = err.status || 500;
  // don't leak internals (stack/db details) for unexpected errors in production
  const msg = status < 500 || process.env.NODE_ENV !== "production" ? err.message : "Server error";
  res.status(status).json({ error: msg || "Server error" });
});

export default app;
