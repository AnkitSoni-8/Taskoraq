// TODO: Add Redis caching layer for heavy analytics queries in future update
import "./src/env.js"; // loads backend/.env (must stay the first import)
import mongoose from "mongoose";
import http from "node:http";
import app, { ORIGINS } from "./src/app.js";
import { initRealtime } from "./src/realtime.js";
import { defaultMongoUri } from "./src/dbUri.js";
import { seedIfEmpty, ensureAuthFields } from "./src/seed.js";

const httpServer = http.createServer(app);
initRealtime(httpServer, ORIGINS);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || (await defaultMongoUri());

async function connect() {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 4000 });
    console.log("MongoDB connected:", MONGO_URI.replace(/\/\/.*@/, "//***@"));
  } catch (e) {
    // no hidden fallback database: a predictable, explicit failure is better than silently losing data on restart
    console.error(`\nCould not connect to MongoDB at ${MONGO_URI.replace(/\/\/.*@/, "//***@")}\n(${e.message})\n`);
    console.error("How to fix:");
    console.error("  1) Local:  install & start MongoDB Community Server (default port 27017), then restart this server, or");
    console.error("  2) Cloud:  create a free MongoDB Atlas cluster, allow your IP, copy its connection string into backend/.env");
    console.error("             MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/taskoraq");
    console.error("  Setup guide: backend/README.md  (Atlas docs: https://www.mongodb.com/docs/atlas/)");
    process.exit(1);
  }
}

connect()
  .then(async () => {
    await seedIfEmpty();
    await ensureAuthFields();
    const server = httpServer.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
    server.on("error", async (e) => {
      if (e.code !== "EADDRINUSE") { console.error(e.message); process.exit(1); }
      // Is the thing on that port already our own API (e.g. `npm run dev` still running in another terminal)?
      const ours = await fetch(`http://127.0.0.1:${PORT}/api/health`).then((r) => r.json()).then((j) => j?.app === "taskoraq").catch(() => false);
      if (ours) {
        console.error(`\nTaskoraq API is already running on port ${PORT} (another terminal / earlier run).`);
        console.error("-> No need to start it again: use that one, or close it first (Ctrl+C in that terminal).");
      } else {
        console.error(`\nPort ${PORT} is already used by another program.`);
      }
      console.error("\nTo free the port:");
      console.error(`  Windows:   netstat -ano | findstr :${PORT}      then      taskkill /PID <PID> /F`);
      console.error(`  Mac/Linux: lsof -i :${PORT}                    then      kill -9 <PID>`);
      console.error("Or use another port: set PORT=5001 in backend/.env (the web dev server picks it up automatically).\n");
      process.exit(1);
    });
  })
  .catch((e) => {
    console.error("Startup failed:", e.message);
    process.exit(1);
  });
