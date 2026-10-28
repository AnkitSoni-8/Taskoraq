// Runs before `npm run dev`: makes sure backend/.env exists and has a JWT_SECRET (never overwrites your other settings).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "backend");
const envFile = path.join(dir, ".env");
const example = path.join(dir, ".env.example");
const secret = crypto.randomBytes(48).toString("hex");

if (!fs.existsSync(envFile)) {
  let txt = fs.existsSync(example) ? fs.readFileSync(example, "utf8") : "PORT=5000\nMONGO_URI=mongodb://127.0.0.1:27017/taskoraq\nCLIENT_ORIGIN=http://localhost:5173\n";
  txt = /^JWT_SECRET=.*$/m.test(txt) ? txt.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`) : txt + `\nJWT_SECRET=${secret}\n`;
  fs.writeFileSync(envFile, txt);
  console.log("[setup] backend/.env created with a random JWT_SECRET");
} else {
  const txt = fs.readFileSync(envFile, "utf8");
  const m = txt.match(/^JWT_SECRET=(.*)$/m);
  if (!m || !m[1].trim() || m[1].includes("change-this")) {
    const out = m ? txt.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`) : txt.replace(/\s*$/, "\n") + `JWT_SECRET=${secret}\n`;
    fs.writeFileSync(envFile, out);
    console.log("[setup] JWT_SECRET added to backend/.env");
  }
}
