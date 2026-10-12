import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { loadEnv, type Connect, type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { createApp } from "./server/app.ts";

/**
 * Serves the talking-points API (/api/status, /api/refine-talking-points) from the dev and preview
 * servers, so `npm run dev` is all that is needed locally. The API key is read here, in Node, and
 * never reaches the browser bundle.
 */
function talkingPointsApi(env: Record<string, string>): Plugin {
  const mount = (middlewares: Connect.Server) => {
    const app = createApp({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL, effort: env.ANTHROPIC_EFFORT });
    // Express apps are connect-style handlers. Only /api requests are passed to it.
    const handle = app as unknown as Connect.NextHandleFunction;
    middlewares.use((req, res, next) => (req.url?.startsWith("/api/") ? handle(req, res, next) : next()));
  };
  return {
    name: "talking-points-api",
    configureServer: (server) => mount(server.middlewares),
    configurePreviewServer: (server) => mount(server.middlewares),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    // GitHub Pages serves a project site from /<repo-name>/. The deploy workflow passes the
    // repository name as BASE_PATH; local development and local builds use "/".
    base: process.env.BASE_PATH || "/",
    plugins: [react(), tailwindcss(), talkingPointsApi(env)],
    // The exported email previews link back to http://localhost:5173, so the port is fixed.
    server: { port: 5173, strictPort: true },
    preview: { port: 5173, strictPort: true },
    test: { environment: "node", include: ["src/**/*.test.ts", "server/**/*.test.ts"] },
  };
});
