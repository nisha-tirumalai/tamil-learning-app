// The call log (spec 003): every call to an outside service (Claude,
// ElevenLabs, Azure) writes one private row to `api_calls`: service, job,
// model or voice, how long it took, how big it was, a rough cost, and any
// error. Never any chat text or audio. Server-only.
//
// Writing the row never slows down or breaks the chat: it happens in the
// background, and a failed write is only noted in the server console.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Service = "claude" | "elevenlabs" | "azure";
/** What the call was for. */
export type Job = "score" | "reply" | "opener" | "tanglish" | "hearing" | "voice";

export interface CallEntry {
  service: Service;
  job: Job;
  model: string;
  /** Until the first piece arrived (streamed calls only). */
  ms_first?: number | null;
  ms_total: number;
  input_tokens?: number | null;
  output_tokens?: number | null;
  /** Characters of text sent to a voice. */
  characters?: number | null;
  /** Seconds of audio sent to hearing. */
  audio_seconds?: number | null;
  cost_usd?: number | null;
  ok: boolean;
  error?: string | null;
}

export interface CallLog {
  add(entry: CallEntry): void;
  /** Waits for rows still being written (so a server function doesn't stop before they land). */
  flush(): Promise<void>;
}

/** Logs nowhere. */
export const noLog: CallLog = { add() {}, async flush() {} };

/** Writes each entry to Supabase as the signed-in person (row-level security applies). */
export function dbLog(db: SupabaseClient): CallLog {
  const pending = new Set<Promise<void>>();
  return {
    add(entry) {
      const p: Promise<void> = Promise.resolve(db.from("api_calls").insert(clean(entry)))
        .then(({ error }) => { if (error) console.warn("call log not written:", error.message); })
        .catch((e) => console.warn("call log not written:", (e as Error).message))
        .finally(() => pending.delete(p));
      pending.add(p);
    },
    async flush() { await Promise.all([...pending]); },
  };
}

/** Keeps entries in memory, for tests. */
export function memoryLog(): CallLog & { entries: CallEntry[] } {
  const entries: CallEntry[] = [];
  return { entries, add(e) { entries.push(clean(e)); }, async flush() {} };
}

function clean(e: CallEntry): CallEntry {
  return {
    ...e,
    ms_first: e.ms_first == null ? null : Math.round(e.ms_first),
    ms_total: Math.round(e.ms_total),
    cost_usd: e.cost_usd == null ? null : Math.round(e.cost_usd * 1e6) / 1e6,
    error: e.error ? e.error.slice(0, 300) : null,
  };
}

/** A stopwatch for one call. */
export function stopwatch() {
  const start = performance.now();
  let first: number | null = null;
  return {
    /** Mark the first piece arriving (only the first call counts). */
    first() { first ??= performance.now() - start; },
    get msFirst() { return first; },
    elapsed() { return performance.now() - start; },
  };
}

/** A short, safe error description for the log (no chat text: just the error's own message). */
export function errorText(e: unknown): string {
  const status = (e as { status?: number })?.status;
  const message = e instanceof Error ? e.message : String(e);
  return (status ? `${status} ` : "") + message.replace(/\s+/g, " ").slice(0, 280);
}
