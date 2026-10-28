// Waits until the API accepts connections on the API port (backend/.env PORT, default 5000), so Vite does not spam "http proxy error ECONNREFUSED" while the backend is still starting.
import net from "node:net";
import { apiPort } from "./api-port.mjs";

const PORT = apiPort();
const LIMIT = 60000;
const t0 = Date.now();
let told = false;

function tryOnce() {
  const s = net.connect({ port: PORT, host: "127.0.0.1" });
  s.once("connect", () => { s.destroy(); process.exit(0); });
  s.once("error", () => {
    s.destroy();
    if (Date.now() - t0 > LIMIT) {
      console.log(`[wait] API did not start on port ${PORT} within 60s - check the [API] logs above (MongoDB running?). Starting web anyway.`);
      process.exit(0);
    }
    if (!told && Date.now() - t0 > 3000) { told = true; console.log(`[wait] waiting for the API on port ${PORT} (it connects to MongoDB first)...`); }
    setTimeout(tryOnce, 500);
  });
}
tryOnce();
