import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { apiPort } from "./scripts/api-port.mjs";

const API = `http://127.0.0.1:${apiPort()}`;

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": API, "/socket.io": { target: API, ws: true } }, // Express backend
  },
});
