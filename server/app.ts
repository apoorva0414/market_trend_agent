import Anthropic from "@anthropic-ai/sdk";
import express, { type Express } from "express";
import type { RefineRequest } from "../src/types.ts";
import { DEFAULT_EFFORT, DEFAULT_MODEL, type Effort, refineTalkingPoints, RequestSchema } from "./refine.ts";

export interface ServerConfig {
  /** From ANTHROPIC_API_KEY in .env. Stays on the server and is never sent to the browser. */
  apiKey?: string;
  model?: string;
  effort?: string;
  /** Origin allowed to call the API from another host, e.g. a GitHub Pages site. */
  corsOrigin?: string;
  /** For tests: a ready-made client instead of one built from apiKey. */
  client?: Anthropic;
}

const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

/**
 * The local API for the talking-points chat:
 *   GET  /api/status                  whether live AI is available
 *   POST /api/refine-talking-points   one refine round
 * Mounted inside the Vite dev server (see vite.config.ts) and runnable on its own (server/index.ts).
 */
export function createApp(config: ServerConfig = {}): Express {
  const model = config.model?.trim() || DEFAULT_MODEL;
  const effort = EFFORTS.find((level) => level === config.effort?.trim()) ?? DEFAULT_EFFORT;
  const client = config.client ?? (config.apiKey ? new Anthropic({ apiKey: config.apiKey, timeout: 60_000, maxRetries: 1 }) : null);

  const app = express();
  app.disable("x-powered-by");

  if (config.corsOrigin) {
    app.use("/api", (req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", config.corsOrigin as string);
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Vary", "Origin");
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }
      next();
    });
  }

  app.get("/api/status", (_req, res) => {
    res.json({ live: client !== null, model: client ? model : null });
  });

  app.post("/api/refine-talking-points", express.json({ limit: "200kb" }), async (req, res) => {
    const parsed = RequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", detail: parsed.error.issues[0]?.message ?? "Invalid request body" });
      return;
    }
    if (!client) {
      res.status(503).json({ error: "no_api_key", detail: "ANTHROPIC_API_KEY is not set. The app falls back to offline quick actions." });
      return;
    }
    try {
      // The schema checks the shape the endpoint relies on; the full RefineRequest type is the browser's contract.
      res.json(await refineTalkingPoints(client, parsed.data as unknown as RefineRequest, { model, effort }));
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        res.status(502).json({ error: "authentication", detail: "The API key was rejected." });
      } else if (error instanceof Anthropic.RateLimitError) {
        res.status(429).json({ error: "rate_limited", detail: "Rate limited by the Claude API. Try again shortly." });
      } else if (error instanceof Anthropic.APIConnectionError) {
        res.status(504).json({ error: "connection", detail: "Could not reach the Claude API." });
      } else if (error instanceof Anthropic.APIError) {
        res.status(502).json({ error: "api_error", detail: `Claude API error ${error.status ?? ""}`.trim() });
      } else {
        res.status(500).json({ error: "refine_failed", detail: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  });

  return app;
}
