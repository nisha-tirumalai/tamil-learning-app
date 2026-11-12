// The model calls behind every turn (SCOPING §2), behind one small
// interface so tests can swap in a fake model (no key, no cost).
//   score(): corrector_scorer → structured JSON (checked in scorer.ts)
//   reply(): tutor_system → Laddu's reply, streamed as text chunks
//   tanglish(): what the hearing service wrote → Tanglish, word for word (spec 003)
// Every real call is written to the call log (spec 003): time, tokens, cost, error.
// Server-only: the Anthropic key never reaches the browser.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type CallLog, errorText, type Job, noLog, stopwatch } from "@/lib/calls";
import { CHAT_CONFIG } from "./config";
import { ScorerWire } from "./scorer";

export type Turn = { role: "user" | "assistant"; content: string };

export interface ChatModel {
  name: string;
  /** Returns the raw answer object; the caller checks it. */
  score(req: { system: string; message: string }): Promise<unknown>;
  /** Yields Laddu's reply a piece at a time. `job` is "opener" for his first line. */
  reply(req: { system: string; messages: Turn[]; job?: "reply" | "opener" }): AsyncIterable<string>;
  /** Rewrites a transcript as Tanglish (returns plain text). */
  tanglish(req: { system: string; text: string }): Promise<string>;
  /** Writes one of Laddu's Tanglish lines in Tamil script, for his voice (returns plain text). */
  tamilScript(req: { system: string; text: string }): Promise<string>;
}

/** Fill {{placeholders}} in a prompt file from prompts/. */
export function loadPrompt(name: string, vars: Record<string, string>): string {
  const text = readFileSync(join(process.cwd(), "prompts", `${name}.md`), "utf8");
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export class ModelNotConfigured extends Error {}

let client: Anthropic | null = null;

/** Rough cost of one call, from the prices in the config. */
export function claudeCost(input: number, output: number): number {
  const p = CHAT_CONFIG.pricePerMillion;
  return (input * p.input + output * p.output) / 1e6;
}

type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };

export function anthropicModel(log: CallLog = noLog): ChatModel {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ModelNotConfigured(
      "Laddu isn't set up yet: add the ANTHROPIC_API_KEY Codespaces secret, reload the codespace, then restart `npm run dev`.",
    );
  }
  // One retry is left to the person (the "tap to try again" button), so the
  // wait never goes far past the timeout.
  client ??= new Anthropic({ timeout: CHAT_CONFIG.timeoutMs, maxRetries: 0 });
  const c = client;
  const model = CHAT_CONFIG.model;
  const record = (job: Job, watch: ReturnType<typeof stopwatch>, usage: Usage | null, error?: unknown) => {
    const input = usage ? usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) : null;
    const output = usage?.output_tokens ?? null;
    log.add({
      service: "claude", job, model, ms_first: watch.msFirst, ms_total: watch.elapsed(),
      input_tokens: input, output_tokens: output,
      cost_usd: usage ? claudeCost(input ?? 0, output ?? 0) : null,
      ok: error === undefined, error: error === undefined ? null : errorText(error),
    });
  };
  return {
    name: model,
    async score({ system, message }) {
      const watch = stopwatch();
      let usage: Usage | null = null;
      try {
        const response = await c.messages.parse({
          model,
          max_tokens: 4000,
          system,
          messages: [{ role: "user", content: message }],
          output_config: { effort: CHAT_CONFIG.scorerEffort, format: zodOutputFormat(ScorerWire) },
        });
        usage = response.usage;
        if (response.stop_reason === "refusal") throw new Error("The model declined this message.");
        if (!response.parsed_output) throw new Error(`No usable answer (stop reason: ${response.stop_reason}).`);
        record("score", watch, usage);
        return response.parsed_output;
      } catch (e) {
        record("score", watch, usage, e);
        throw e;
      }
    },
    async *reply({ system, messages, job = "reply" }) {
      const watch = stopwatch();
      const stream = c.messages.stream({
        model,
        max_tokens: 1000,
        system,
        messages,
        output_config: { effort: CHAT_CONFIG.tutorEffort },
      });
      let finished = false;
      let logged = false;
      const once = (usage: Usage | null, error?: unknown) => { if (!logged) { logged = true; record(job, watch, usage, error); } };
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            watch.first();
            yield event.delta.text;
          }
        }
        const final = await stream.finalMessage();
        finished = true;
        if (final.stop_reason === "refusal") {
          const e = new Error("The model declined to reply.");
          once(final.usage, e);
          throw e;
        }
        once(final.usage);
      } catch (e) {
        once(null, e);
        throw e;
      } finally {
        // Stopped early (e.g. Tamil script on the screen lines): end the request and log it.
        if (!finished) {
          stream.abort();
          once(null, new Error("stopped early"));
        }
      }
    },
    tanglish: ({ system, text }) => plain("tanglish", system, `Transcript: ${text}`),
    tamilScript: ({ system, text }) => plain("tamil", system, text),
  };

  async function plain(job: "tanglish" | "tamil", system: string, content: string): Promise<string> {
    const watch = stopwatch();
    let usage: Usage | null = null;
    try {
      const response = await c.messages.create({
        model,
        max_tokens: 1000,
        system,
        messages: [{ role: "user", content }],
        output_config: { effort: "low" },
      });
      usage = response.usage;
      if (response.stop_reason === "refusal") throw new Error("The model declined this.");
      record(job, watch, usage);
      return response.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    } catch (e) {
      record(job, watch, usage, e);
      throw e;
    }
  }
}

/**
 * A pretend model for tests. Give it the answers to return, in order; an
 * Error in the list is thrown instead (to test the friendly error).
 */
export class FakeModel implements ChatModel {
  name = "fake";
  scoreCalls: { system: string; message: string }[] = [];
  replyCalls: { system: string; messages: Turn[]; job?: string }[] = [];
  tanglishCalls: { system: string; text: string }[] = [];
  /** Answers for tanglish(), in order. Empty = return the text unchanged. */
  tanglishAnswers: (string | Error)[] = [];
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

  async tanglish(req: { system: string; text: string }) {
    this.tanglishCalls.push(req);
    const next = this.tanglishAnswers.shift();
    if (next instanceof Error) throw next;
    return next ?? req.text;
  }

  tamilCalls: { system: string; text: string }[] = [];
  /** Answers for tamilScript(), in order. Empty = "(no answer)" → no Tamil line. */
  tamilAnswers: (string | Error)[] = [];
  async tamilScript(req: { system: string; text: string }) {
    this.tamilCalls.push(req);
    const next = this.tamilAnswers.shift();
    if (next instanceof Error) throw next;
    return next ?? "";
  }

  async *reply(req: { system: string; messages: Turn[]; job?: "reply" | "opener" }) {
    this.replyCalls.push(req);
    const next = this.replies.shift();
    if (next === undefined) throw new Error("FakeModel: no reply queued");
    if (next instanceof Error) throw next;
    // Stream it in a few pieces, like the real thing.
    for (const piece of next.match(/.{1,8}/gs) ?? []) yield piece;
  }
}
