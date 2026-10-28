// Reads PORT from backend/.env (default 5000) so the API, the Vite proxy and the wait script always agree.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function apiPort() {
  if (process.env.API_PORT) return Number(process.env.API_PORT);
  try {
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "backend", ".env");
    const m = fs.readFileSync(file, "utf8").match(/^\s*PORT\s*=\s*["']?(\d+)["']?/m);
    if (m) return Number(m[1]);
  } catch { /* no .env yet */ }
  return 5000;
}
