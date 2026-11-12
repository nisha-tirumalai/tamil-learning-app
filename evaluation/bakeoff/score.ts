// Scoring a transcript against what Nisha said (spec 003 hearing test).
//
// Two measures:
//  1. "Sound-alike" character error rate, no AI, no cost: both texts are turned
//     into Latin letters (Tamil script is transliterated), then squashed to a
//     rough sound skeleton so Tanglish spelling (th/dh, aa/a, double letters)
//     and word splits ("veetukku" / "veettu kku") don't count as errors.
//  2. An AI grader (Claude, only if ANTHROPIC_API_KEY is set, ~1 cent for all):
//     words wrong, English words kept, and mistakes the service "fixed".

import { hasTamil, transliterate } from "../../src/lib/voice/letters.ts";

export { hasTamil, transliterate };

/** Squashes text to a sound skeleton (see the note at the top). */
export function skeleton(text: string): string {
  let s = transliterate(text).toLowerCase().replace(/[^a-z]/g, "");
  for (const [a, b] of [["zh", "l"], ["sh", "s"], ["ch", "s"], ["th", "t"], ["dh", "t"], ["bh", "p"], ["ph", "p"], ["kh", "k"], ["gh", "k"], ["ng", "n"], ["nj", "n"]] as const) {
    s = s.replaceAll(a, b);
  }
  s = s.replace(/[d]/g, "t").replace(/b/g, "p").replace(/g/g, "k").replace(/j/g, "s").replace(/c/g, "k")
    .replace(/f/g, "p").replace(/w/g, "v").replace(/z/g, "s").replace(/q/g, "k").replace(/x/g, "ks")
    .replace(/ee|ii/g, "i").replace(/oo|uu/g, "u").replace(/aa/g, "a").replace(/ae/g, "e");
  return s.replace(/(.)\1+/g, "$1");
}

export function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** 0 = identical, 1 = completely different (can go a little over 1). */
export function soundAlikeErrorRate(said: string, heard: string): number {
  const a = skeleton(said), b = skeleton(heard);
  return a.length ? editDistance(a, b) / a.length : 0;
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}]/u.test(w)).length;
}
