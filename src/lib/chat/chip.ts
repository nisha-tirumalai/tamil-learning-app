// What the small chip under one of my messages shows (spec 002).
import { CHIP_TEXT, HINT_BELOW } from "./config";
import type { Attempt } from "./turn";

export type Chip =
  | { kind: "none" }                       // safety message, or nothing to show
  | { kind: "pending"; label: string }     // score still coming: "⭐ …"
  | { kind: "failed"; label: string }      // tap to score again
  | { kind: "open"; label: string };       // tap to open the card

/**
 * `attempts` = my message and its try-agains; the chip is about the latest.
 * `pending` = attempt ids whose score is still on its way.
 * `readOnly` (past chats): a missing score shows nothing, since there's no retry.
 */
export function chipFor(attempts: Attempt[], pending: ReadonlySet<number>, readOnly = false): Chip {
  const latest = attempts.at(-1);
  if (!latest) return { kind: "none" };
  const totals = attempts.slice(0, -1).map((a) => a.score?.total).filter((t): t is number => typeof t === "number");
  const before = totals.length ? `${totals[0]} → ` : "";

  if (pending.has(latest.id)) return { kind: "pending", label: `⭐ ${before}…` };
  const score = latest.score;
  if (!score) return readOnly ? { kind: "none" } : { kind: "failed", label: CHIP_TEXT.failed };
  const { card } = score;
  if (card.kind === "safety") return { kind: "none" };
  if (card.kind === "all_english") return { kind: "open", label: CHIP_TEXT.allEnglish };
  if (card.praise) return { kind: "open", label: before ? `⭐ ${before}10 · ${card.praise.tanglish}` : card.praise.tanglish };
  return { kind: "open", label: `⭐ ${before}${score.total}` };
}

/**
 * The small "💡 Try: …" card near my bubble (spec 003): shown when my latest
 * line scored below 7. It reuses the better way the scorer already wrote, so
 * it costs no extra AI call. null = no hint (good score, score still coming,
 * all English, safety, or no score).
 */
export function lowScoreHint(attempts: Attempt[] | null, pending: ReadonlySet<number>): { id: number; better: string; english: string } | null {
  const latest = attempts?.at(-1);
  if (!latest || pending.has(latest.id) || !latest.score) return null;
  const { total, card } = latest.score;
  if (card.kind !== "scored" || total === null || total >= HINT_BELOW || !card.better.trim()) return null;
  return { id: latest.id, better: card.better, english: card.better_english };
}
