// Tamil script → rough Latin letters, with no AI and no cost. Used by the
// bake-off scorer, and by the app as a last resort when the Tanglish rewrite
// of what Laddu heard fails (spec 003), so Tamil script never reaches the screen.
// No imports, so the bake-off scripts can run this file directly with node.

const VOWELS: Record<string, string> = { "அ": "a", "ஆ": "aa", "இ": "i", "ஈ": "ii", "உ": "u", "ஊ": "uu", "எ": "e", "ஏ": "e", "ஐ": "ai", "ஒ": "o", "ஓ": "o", "ஔ": "au", "ஃ": "h" };
const CONSONANTS: Record<string, string> = {
  "க": "k", "ங": "ng", "ச": "s", "ஞ": "nj", "ட": "d", "ண": "n", "த": "th", "ந": "n", "ப": "p", "ம": "m", "ய": "y",
  "ர": "r", "ல": "l", "வ": "v", "ழ": "zh", "ள": "l", "ற": "r", "ன": "n", "ஜ": "j", "ஷ": "sh", "ஸ": "s", "ஹ": "h",
};
// ஏ and ஓ become plain "e" and "o", the way Tanglish writes them (poren, not pooreen).
const SIGNS: Record<string, string> = { "ா": "aa", "ி": "i", "ீ": "ii", "ு": "u", "ூ": "uu", "ெ": "e", "ே": "e", "ை": "ai", "ொ": "o", "ோ": "o", "ௌ": "au" };
const VIRAMA = "்";

/** Tamil script → rough Latin letters. Latin text passes through unchanged. */
export function transliterate(text: string): string {
  let out = "";
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (CONSONANTS[c]) {
      const next = chars[i + 1];
      if (next === VIRAMA) { out += CONSONANTS[c]; i++; }
      else if (next && SIGNS[next]) { out += CONSONANTS[c] + SIGNS[next]; i++; }
      else out += CONSONANTS[c] + "a";
    } else out += VOWELS[c] ?? c;
  }
  return out;
}

export function hasTamil(text: string): boolean {
  return /[஀-௿]/.test(text);
}
