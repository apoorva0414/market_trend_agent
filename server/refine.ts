import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { allowedNumbers, asksForPromisedReturn, enforceLockedFigures, REFUSAL_REPLY } from "../src/talkingPoints/lockedFacts.ts";
import type { RefineRequest, RefineResponse } from "../src/types.ts";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt.ts";

export const DEFAULT_MODEL = "claude-sonnet-5-5";
/** Chat rewrites should feel quick. Raise with ANTHROPIC_EFFORT if quality needs it. */
export const DEFAULT_EFFORT = "low";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

const WordingSchema = z.object({
  summary: z.string(),
  talkingPoints: z.array(z.string()),
  nextSteps: z.array(z.string()),
  disclaimer: z.string(),
});

/** What the model must return: the document schema plus a one-line reply. */
const OutputSchema = z.object({
  updatedDoc: WordingSchema,
  reply: z.string(),
});

const Text = z.string().max(4000);

export const RequestSchema = z.object({
  currentDoc: WordingSchema,
  factsLocked: z.looseObject({ disclaimer: z.string() }),
  theme: z.looseObject({ title: Text, type: z.enum(["Pulse", "View"]) }),
  client: z.looseObject({ name: Text }),
  houseView: z.array(z.looseObject({ assetClass: Text })).max(20),
  instruction: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["agent", "rm"]), text: Text })).max(60),
});

/** Models that accept the server-side refusal fallback in its "default" form. */
const SERVER_SIDE_FALLBACK = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"]);

export interface RefineOptions {
  model: string;
  effort: Effort;
}

/** The subset of the SDK response this module reads, common to the beta and stable endpoints. */
interface ParsedReply {
  stop_reason: string | null;
  parsed_output: z.infer<typeof OutputSchema> | null;
}

async function callClaude(client: Anthropic, request: RefineRequest, { model, effort }: RefineOptions): Promise<ParsedReply> {
  const base = {
    model,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user" as const, content: buildUserMessage(request) }],
  };

  if (SERVER_SIDE_FALLBACK.has(model)) {
    try {
      // If a safety classifier declines the request, the API retries it on the model Anthropic
      // recommends for that refusal category instead of returning the refusal.
      return await client.beta.messages.parse({
        ...base,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort, format: betaZodOutputFormat(OutputSchema) },
      });
    } catch (error) {
      // A rejected beta parameter should not take the feature down: retry once on the stable endpoint.
      if (!(error instanceof Anthropic.BadRequestError)) throw error;
    }
  }

  return client.messages.parse({
    ...base,
    output_config: { effort, format: zodOutputFormat(OutputSchema) },
  });
}

/**
 * One refine round against the Claude API. The model edits wording only; the locked-figures check
 * runs here as well as in the browser, so the endpoint never returns an invented number.
 */
export async function refineTalkingPoints(client: Anthropic, request: RefineRequest, options: RefineOptions): Promise<RefineResponse> {
  const unchanged = (reply: string): RefineResponse => ({ updatedDoc: request.currentDoc, reply, rejectedFields: [] });

  if (asksForPromisedReturn(request.instruction)) return unchanged(REFUSAL_REPLY);

  const message = await callClaude(client, request, options);

  if (message.stop_reason === "refusal") {
    return unchanged("The model declined this request, so the draft is unchanged.");
  }
  if (message.stop_reason === "max_tokens" || !message.parsed_output) {
    throw new Error(`Model returned no usable document (stop_reason: ${message.stop_reason})`);
  }

  const { updatedDoc, reply } = message.parsed_output;
  const checked = enforceLockedFigures(request.currentDoc, updatedDoc, allowedNumbers(request));
  return {
    // The disclaimer is a locked placeholder: whatever the model returned, the original is kept.
    updatedDoc: { ...checked.wording, disclaimer: request.currentDoc.disclaimer },
    reply: reply.trim() || "Updated the draft.",
    rejectedFields: checked.rejectedFields,
  };
}
