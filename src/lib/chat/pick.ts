// Random picks that never repeat the previous one: Laddu's situation and the praise line.
import { PRAISE_LINES, SITUATIONS } from "./config";

function pickOther<T>(list: readonly T[], isLast: (item: T) => boolean, random: () => number): T {
  const choices = list.length > 1 ? list.filter((x) => !isLast(x)) : list;
  return choices[Math.floor(random() * choices.length)];
}

/** A random situation, never the same key as `lastKey`. */
export function pickSituation(lastKey: string | null | undefined, random = Math.random) {
  return pickOther(SITUATIONS, (s) => s.key === lastKey, random);
}

/** A random praise line, never the same as `last`. */
export function pickPraise(last: string | null | undefined, random = Math.random) {
  return pickOther(PRAISE_LINES, (p) => p.tanglish === last, random);
}

export function findSituation(key: string | null | undefined) {
  return SITUATIONS.find((s) => s.key === key);
}

/** "nisha.tirumalai" → "Nisha". Used when the profile name is still the email prefix. */
export function firstName(displayName: string | null | undefined): string {
  const first = (displayName ?? "").trim().split(/[\s._-]+/)[0] ?? "";
  return first ? first[0].toUpperCase() + first.slice(1) : "friend";
}
