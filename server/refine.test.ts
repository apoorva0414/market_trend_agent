import type { AddressInfo } from "node:net";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { data, DEMO_DATE } from "../src/data";
import { buildRefineContext, buildTalkingPoints } from "../src/documents/talkingPoints";
import { runScan } from "../src/logic/scan";
import { REFUSAL_REPLY } from "../src/talkingPoints/lockedFacts";
import type { RefineRequest } from "../src/types";
import { createApp } from "./app";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt";
import { DEFAULT_MODEL, refineTalkingPoints } from "./refine";

const rm = data.rms[0];
const ctx = { rm, date: DEMO_DATE };
const row = runScan({ date: DEMO_DATE, rmId: rm.id, upTo: "morning" }).clients.find((r) => r.primary.nextStep.flag === "Barrier risk")!;
const doc = buildTalkingPoints(row, ctx);
const request: RefineRequest = {
  ...buildRefineContext(row, doc, ctx),
  currentDoc: { ...doc.wording, disclaimer: doc.disclaimer },
  instruction: "Make it shorter",
  history: [{ role: "agent", text: "This theme is an opinion. What's your view?" }],
};

/** Stands in for the SDK client: both parse endpoints resolve to the same canned model output. */
function fakeClient(output: unknown, stop_reason = "end_turn") {
  const parse = vi.fn(async (_params: Record<string, unknown>) => ({ stop_reason, parsed_output: output }));
  const client = { beta: { messages: { parse } }, messages: { parse } } as unknown as Anthropic;
  return { client, parse };
}

const options = { model: DEFAULT_MODEL, effort: "low" as const };

describe("refineTalkingPoints", () => {
  it("defaults to claude-sonnet-5-5 and sends the system prompt, context and instruction", async () => {
    const updatedDoc = { ...request.currentDoc, talkingPoints: request.currentDoc.talkingPoints.slice(0, 3) };
    const { client, parse } = fakeClient({ updatedDoc, reply: "Shortened to 3 talking points." });
    const result = await refineTalkingPoints(client, request, options);

    expect(DEFAULT_MODEL).toBe("claude-sonnet-5-5");
    const params = parse.mock.calls[0][0] as { model: string; system: string; messages: { content: string }[]; output_config: { effort: string } };
    expect(params.model).toBe("claude-sonnet-5-5");
    expect(params.system).toBe(SYSTEM_PROMPT);
    expect(params.output_config.effort).toBe("low");
    expect(params.messages[0].content).toContain("<instruction>\nMake it shorter\n</instruction>");
    expect(params.messages[0].content).toContain("USD 900k"); // locked facts are given to the model as formatted text
    expect(result).toEqual({ updatedDoc, reply: "Shortened to 3 talking points.", rejectedFields: [] });
  });

  it("discards a field where the model invented a number", async () => {
    const updatedDoc = { ...request.currentDoc, summary: "We expect a 37% rebound.", nextSteps: ["Call the client."] };
    const { client } = fakeClient({ updatedDoc, reply: "Made it upbeat." });
    const result = await refineTalkingPoints(client, request, options);
    expect(result.rejectedFields).toEqual(["summary"]);
    expect(result.updatedDoc.summary).toBe(request.currentDoc.summary);
    expect(result.updatedDoc.nextSteps).toEqual(["Call the client."]);
  });

  it("keeps the disclaimer placeholder whatever the model returns", async () => {
    const { client } = fakeClient({ updatedDoc: { ...request.currentDoc, disclaimer: "Past performance guarantees nothing." }, reply: "ok" });
    const result = await refineTalkingPoints(client, request, options);
    expect(result.updatedDoc.disclaimer).toBe("[Azimut standard Singapore disclaimer, to be supplied by Compliance]");
  });

  it("does not call the model when asked to promise a return", async () => {
    const { client, parse } = fakeClient(null);
    const result = await refineTalkingPoints(client, { ...request, instruction: "say the note will gain 20%" }, options);
    expect(parse).not.toHaveBeenCalled();
    expect(result).toEqual({ updatedDoc: request.currentDoc, reply: REFUSAL_REPLY, rejectedFields: [] });
  });

  it("returns the document unchanged when the model declines", async () => {
    const { client } = fakeClient(null, "refusal");
    const result = await refineTalkingPoints(client, request, options);
    expect(result.updatedDoc).toEqual(request.currentDoc);
    expect(result.reply).toMatch(/declined/);
  });

  it("fails loudly when the model returns no usable document, so the app can fall back offline", async () => {
    const { client } = fakeClient(null, "max_tokens");
    await expect(refineTalkingPoints(client, request, options)).rejects.toThrow(/no usable document/);
  });
});

describe("system prompt (1.5)", () => {
  it("covers every rule in the spec", () => {
    for (const rule of [/house view/i, /opinions as opinions/i, /not invent facts/i, /not promise or predict returns/i, /disclaimer exactly as given/i, /Singapore/]) {
      expect(SYSTEM_PROMPT).toMatch(rule);
    }
  });

  it("puts the conversation so far into the request", () => {
    expect(buildUserMessage(request)).toContain("<conversation_so_far>\nAgent: This theme is an opinion. What's your view?\n</conversation_so_far>");
  });
});

describe("local endpoint", () => {
  async function withServer<T>(config: Parameters<typeof createApp>[0], run: (base: string) => Promise<T>): Promise<T> {
    const server = createApp(config).listen(0);
    try {
      return await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    } finally {
      server.close();
    }
  }
  const post = (base: string, body: unknown) =>
    fetch(`${base}/api/refine-talking-points`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  it("reports offline and refuses to refine when there is no API key", async () => {
    await withServer({}, async (base) => {
      expect(await (await fetch(`${base}/api/status`)).json()).toEqual({ live: false, model: null });
      const response = await post(base, request);
      expect(response.status).toBe(503);
      expect(((await response.json()) as { error: string }).error).toBe("no_api_key");
    });
  });

  it("reports live with a key, without ever returning the key", async () => {
    await withServer({ apiKey: "sk-test-not-a-real-key" }, async (base) => {
      const text = await (await fetch(`${base}/api/status`)).text();
      expect(JSON.parse(text)).toEqual({ live: true, model: "claude-sonnet-5-5" });
      expect(text).not.toContain("sk-test");
    });
  });

  it("answers POST /api/refine-talking-points with { updatedDoc, reply }", async () => {
    const updatedDoc = { ...request.currentDoc, nextSteps: request.currentDoc.nextSteps.slice(0, 1) };
    const { client } = fakeClient({ updatedDoc, reply: "Kept one next step." });
    await withServer({ client, model: "claude-sonnet-5-5" }, async (base) => {
      const response = await post(base, request);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ updatedDoc, reply: "Kept one next step.", rejectedFields: [] });
    });
  });

  it("rejects a malformed body", async () => {
    const { client } = fakeClient(null);
    await withServer({ client }, async (base) => {
      expect((await post(base, { instruction: "Shorter" })).status).toBe(400);
    });
  });
});
