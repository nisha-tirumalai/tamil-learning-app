// What the corrector_scorer model call must return, and the strict check that
// rejects anything malformed (wrong total, out-of-range part, unknown mistake
// type, Tamil script). A rejected answer is never shown or saved.
import { z } from "zod";
import { MISTAKE_TYPES } from "./config";
import { hasTamilScript } from "./tamil";

/**
 * The shape sent to the model as its output format. Kept loose (no number
 * ranges) because structured outputs don't enforce ranges; `checkScorerOutput`
 * enforces them afterwards.
 */
export const ScorerWire = z.object({
  kind: z.enum(["scored", "all_english", "safety"])
    .describe("scored = Tanglish attempt; all_english = no Tamil words at all; safety = self-harm or harming others"),
  understood: z.string().describe("English: what you think Nisha meant"),
  better: z.string().describe("The natural spoken-Tamil way to say it, in Tanglish (Latin letters only)"),
  better_english: z.string().describe("English meaning of `better`"),
  alternative: z.string().nullable().describe("Optional second natural way, Tanglish, or null"),
  alternative_english: z.string().nullable(),
  why: z.string().describe("One short line in English explaining the main fix (empty if perfect)"),
  hint: z.string().describe("One clue for a retry, never the full answer (empty if perfect)"),
  // Listed BEFORE the scores on purpose: the model writes fields in order, so
  // it finds the mistakes first and then scores from that list (steadier).
  mistakes: z.array(z.object({
    said: z.string().describe("The words she wrote"),
    fix: z.string().describe("What a native speaker would say instead"),
    type: z.enum(MISTAKE_TYPES),
    part: z.enum(["grammar", "spoken"]),
    size: z.enum(["small", "big"]),
  })).describe("Every real mistake, one entry each; empty if the sentence is already correct"),
  mistake_types: z.array(z.enum(MISTAKE_TYPES)).describe("The distinct types from `mistakes`"),
  grammar: z.number().int().nullable().describe("0-6, null unless kind = scored"),
  spoken: z.number().int().nullable().describe("0-4, null unless kind = scored"),
  total: z.number().int().nullable().describe("grammar + spoken, null unless kind = scored"),
  care_message: z.string().nullable().describe("Only for kind = safety: a caring message in English"),
});
export type ScorerOutput = z.infer<typeof ScorerWire>;

export type CheckResult = { ok: true; value: ScorerOutput } | { ok: false; problem: string };

export function checkScorerOutput(raw: unknown): CheckResult {
  const parsed = ScorerWire.safeParse(raw);
  if (!parsed.success) return { ok: false, problem: `shape: ${parsed.error.issues[0]?.message ?? "invalid"}` };
  const v = parsed.data;
  if (hasTamilScript(v)) return { ok: false, problem: "Tamil script" };

  if (v.kind === "scored") {
    const { grammar: g, spoken: s, total: t } = v;
    if (g === null || s === null || t === null) return { ok: false, problem: "missing score part" };
    if (g < 0 || g > 6) return { ok: false, problem: "grammar out of range" };
    if (s < 0 || s > 4) return { ok: false, problem: "spoken out of range" };
    if (t !== g + s) return { ok: false, problem: "total isn't grammar + spoken" };
    if (!v.better.trim()) return { ok: false, problem: "no better way" };
  } else {
    // All-English and safety messages are never scored.
    if (v.grammar !== null || v.spoken !== null || v.total !== null) {
      return { ok: true, value: { ...v, grammar: null, spoken: null, total: null } };
    }
    if (v.kind === "safety" && !v.care_message?.trim()) return { ok: false, problem: "no care message" };
  }
  return { ok: true, value: v };
}

/** What a correction card shows (stored in scores.card, sent to the browser). */
export interface Card {
  kind: ScorerOutput["kind"];
  understood: string;
  better: string;
  better_english: string;
  alternative: string | null;
  alternative_english: string | null;
  why: string;
  hint: string;
  care_message: string | null;
  /** Set when the message scored 10/10: shown instead of a correction. */
  praise: { tanglish: string; english: string } | null;
}

export interface Score {
  grammar: number | null;
  spoken: number | null;
  total: number | null;
  mistake_types: string[];
  card: Card;
}

export function toScore(v: ScorerOutput, praise: Card["praise"]): Score {
  const perfect = v.kind === "scored" && v.total === 10;
  return {
    grammar: v.grammar,
    spoken: v.spoken,
    total: v.total,
    mistake_types: perfect ? [] : v.mistake_types,
    card: {
      kind: v.kind,
      understood: v.understood,
      better: v.better,
      better_english: v.better_english,
      alternative: v.alternative,
      alternative_english: v.alternative_english,
      why: v.why,
      hint: v.hint,
      care_message: v.kind === "safety" ? v.care_message : null,
      praise: perfect ? praise : null,
    },
  };
}
