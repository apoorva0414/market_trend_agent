import type { RefineRequest, RefineResponse } from "../types";

/**
 * Where the talking-points API lives. With nothing configured, a production build (such as the
 * GitHub Pages site) has no endpoint and the chat runs offline without making any request.
 * In development the Vite dev server serves the API itself at /api.
 */
function resolveEndpoint(): string {
  const configured = (import.meta.env.VITE_AI_ENDPOINT as string | undefined)?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return import.meta.env.DEV ? "/api" : "";
}

export const AI_ENDPOINT = resolveEndpoint();

export type AiStatus = "checking" | "live" | "offline";

/** Live only when an endpoint is configured, reachable, and reports that it has an API key. */
export async function fetchAiStatus(endpoint = AI_ENDPOINT): Promise<"live" | "offline"> {
  if (!endpoint) return "offline";
  try {
    const response = await fetch(`${endpoint}/status`, { headers: { Accept: "application/json" } });
    if (!response.ok) return "offline";
    const body = (await response.json()) as { live?: boolean };
    return body.live === true ? "live" : "offline";
  } catch {
    return "offline";
  }
}

export async function refineLive(request: RefineRequest, endpoint = AI_ENDPOINT): Promise<RefineResponse> {
  const response = await fetch(`${endpoint}/refine-talking-points`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`Refine request failed with status ${response.status}`);
  const body = (await response.json()) as RefineResponse;
  if (!body?.updatedDoc || typeof body.reply !== "string") throw new Error("Refine response was not in the expected shape");
  return { ...body, rejectedFields: body.rejectedFields ?? [] };
}
