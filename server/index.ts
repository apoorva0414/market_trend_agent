// Runs the talking-points API on its own: `npm run server`.
// Not needed for `npm run dev`, where the same app is mounted inside the Vite dev server.
import { createApp } from "./app.ts";

try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the environment. Without a key the API reports itself as offline.
}

const port = Number(process.env.PORT ?? 8787);
const app = createApp({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: process.env.ANTHROPIC_MODEL,
  effort: process.env.ANTHROPIC_EFFORT,
  corsOrigin: process.env.CORS_ORIGIN,
});

app.listen(port, () => {
  const live = Boolean(process.env.ANTHROPIC_API_KEY);
  console.log(`Talking-points API on http://localhost:${port}/api · AI ${live ? "live" : "offline (no ANTHROPIC_API_KEY)"}`);
});
