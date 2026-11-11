// The two model calls behind every turn (SCOPING §2), behind one small
// interface so tests can swap in a fake model (no key, no cost).
//   score(): corrector_scorer → structured JSON (checked in scorer.ts)
//   reply(): tutor_system → Laddu's reply, streamed as text chunks
// Server-only: the Anthropic key never reaches the browser.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHAT_CONFIG } from "./config";
import { ScorerWire } from "./scorer";

export type Turn = { role: "user" | "assistant"; content: string };

export interface ChatModel {
  name: string;
  /** Returns the raw answer object; the caller checks it. */
  score(req: { system: string; message: string }): Promise<unknown>;
  /** Yields Laddu's reply a piece at a time. */
  reply(req: { system: string; messages: Turn[] }): AsyncIterable<string>;
}

/** Fill {{placeholders}} in a prompt file from prompts/. */
export function loadPrompt(name: string, vars: Record<string, string>): string {
  const text = readFileSync(join(process.cwd(), "prompts", `${name}.md`), "utf8");
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export class ModelNotConfigured extends Error {}

let client: Anthropic | null = null;

export function anthropicModel(): ChatModel {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ModelNotConfigured(
      "Laddu isn't set up yet: add the ANTHROPIC_API_KEY Codespaces secret, reload the codespace, then restart `npm run dev`.",
    );
  }
  // One retry is left to the person (the "tap to try again" button), so the
  // wait never goes far past the timeout.
  client ??= new Anthropic({ timeout: CHAT_CONFIG.timeoutMs, maxRetries: 0 });
  const c = client;
  return {
    name: CHAT_CONFIG.model,
    async score({ system, message }) {
      const response = await c.messages.parse({
        model: CHAT_CONFIG.model,
        max_tokens: 4000,
        system,
        messages: [{ role: "user", content: message }],
        output_config: { effort: CHAT_CONFIG.scorerEffort, format: zodOutputFormat(ScorerWire) },
      });
      if (response.stop_reason === "refusal") throw new Error("The model declined this message.");
      if (!response.parsed_output) throw new Error(`No usable answer (stop reason: ${response.stop_reason}).`);
      return response.parsed_output;
    },
    async *reply({ system, messages }) {
      const stream = c.messages.stream({
        model: CHAT_CONFIG.model,
        max_tokens: 1000,
        system,
        messages,
        output_config: { effort: CHAT_CONFIG.tutorEffort },
      });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") throw new Error("The model declined to reply.");
    },
  };
}

/**
 * A pretend model for tests. Give it the answers to return, in order; an
 * Error in the list is thrown instead (to test the friendly error).
 */
export class FakeModel implements ChatModel {
  name = "fake";
  scoreCalls: { system: string; message: string }[] = [];
  replyCalls: { system: string; messages: Turn[] }[] = [];
  /** Make scoring slow, to check that Laddu's reply doesn't wait for it. */
  scoreDelayMs = 0;
  constructor(public scores: unknown[] = [], public replies: (string | Error)[] = []) {}

  async score(req: { system: string; message: string }) {
    this.scoreCalls.push(req);
    if (this.scoreDelayMs) await new Promise((r) => setTimeout(r, this.scoreDelayMs));
    const next = this.scores.shift();
    if (next === undefined) throw new Error("FakeModel: no score queued");
    if (next instanceof Error) throw next;
    return next;
  }

  async *reply(req: { system: string; messages: Turn[] }) {
    this.replyCalls.push(req);
    const next = this.replies.shift();
    if (next === undefined) throw new Error("FakeModel: no reply queued");
    if (next instanceof Error) throw next;
    // Stream it in a few pieces, like the real thing.
    for (const piece of next.match(/.{1,8}/gs) ?? []) yield piece;
  }
}
