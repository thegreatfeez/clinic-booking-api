import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, serverRoot, "");
  const apiKey = process.env.API_KEY ?? env.API_KEY ?? "";

  return {
    plugins: [react()],
    define: {
      __API_KEY__: JSON.stringify(apiKey)
    },
    server: {
      port: 5173,
      proxy: {
        "/slots": "http://localhost:3000",
        "/bookings": "http://localhost:3000",
        "/reset": "http://localhost:3000",
        "/health": "http://localhost:3000"
      }
    }
  };
});
