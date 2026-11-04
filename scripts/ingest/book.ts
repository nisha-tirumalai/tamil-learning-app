// Turns one lesson of Adi's Book into practice items.
//
// Lines look like  "3.«ammā vānga»Madam, come."  (numbered sentence),
// "A.«vaṇakkam ammā.»Greetings, madam."  (conversation) or
// "«vānga»Come (polite form)"  (vocabulary), where «» is the romanized Tamil.
// The book has no Tamil script, so 'tamil' starts empty and is filled in from
// lessons/overrides.json; until then the item is tagged "missing-tamil".
import { createHash } from "node:crypto";
import type { PdfLine } from "./pdf.ts";
import { englishness, type Item, type ItemType } from "./parse.ts";

// Lines whose fonts are mixed up in the PDF, so the normal shape check skips them.
// Matched against the line's plain text; the repaired line is parsed like any other.
// [\s\u0085]: the PDF has an invisible "next line" character (U+0085) between the
// words, which JavaScript's \s doesn't match.
const REPAIRS: { match: RegExp; tanglish: string; english: string; tags: string[] }[] = [
  { match: /^namaskāram[\s\u0085]*Greeting, interchangeable/, tanglish: "namaskāram", english: "Greeting, interchangeable with ‘vaṇakkam’.", tags: ["greeting"] },
  { match: /^nandri[\s\u0085]*Thanks/, tanglish: "nandri", english: "Thanks.", tags: ["greeting"] },
];

export function parseBookLesson(pages: PdfLine[][], lesson: number): Item[] {
  const lines = pages.flat();
  const start = lines.findIndex((l) => isLessonHeading(l, lesson));
  if (start < 0) throw new Error(`Book lesson ${lesson} not found`);
  const end = lines.findIndex((l, i) => i > start && isLessonHeading(l, lesson + 1));
  const items: Item[] = [];
  const seen = new Set<string>();
  let section = "Vocabulary";

  for (const line of lines.slice(start + 1, end < 0 ? undefined : end)) {
    const text = line.map((p) => p.text).join("").trim();
    if (/^practical conversation/i.test(text)) { section = "Practical Conversation"; continue; }
    if (/^short sentences/i.test(text)) { section = "Short Sentences"; continue; }

    // Expect: optional label ("3." or "A."), then romanized Tamil, then English.
    const repair = REPAIRS.find((r) => r.match.test(text));
    let pieces: PdfLine = repair
      ? [{ kind: "tl", text: repair.tanglish }, { kind: "en", text: repair.english }] as PdfLine
      : line;
    let label = "";
    if (pieces[0]?.kind === "en" && /^\s*(\d+\.?|[A-Z]\.)\s*$/.test(pieces[0].text)) { label = pieces[0].text.trim(); pieces = pieces.slice(1); }
    if (pieces.length !== 2 || pieces[0].kind !== "tl" || pieces[1].kind !== "en") continue;
    let tanglish = pieces[0].text.trim();
    const english = pieces[1].text.trim().replace(/^[,.\s]+|[\s-]+$/g, "");
    if (!english || englishness(tanglish) >= 2) continue;    // English that happens to be in the Tamil font

    // "(vaṇakkam aiyā)" or "(or vāngammā)" after the main form = another way to say it.
    const alternates: { tanglish: string; tamil: string }[] = [];
    tanglish = tanglish.replace(/\s*\((?:or\s+)?([^()]+)\)\s*/g, (_, alt: string) => {
      alternates.push({ tanglish: alt.trim(), tamil: "" });
      return " ";
    }).replace(/[,\s]+$/, "").replace(/\s+/g, " ").trim();
    if (!tanglish) continue;

    const key = tanglish.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);

    const type: ItemType = /^[A-Z]\.$/.test(label) || section === "Practical Conversation" ? "dialogue"
      : section === "Short Sentences" || tanglish.split(/\s+/).length > 2 ? "sentence" : "vocab";
    items.push({
      id: `B${String(lesson).padStart(2, "0")}-${createHash("sha1").update(key).digest("hex").slice(0, 8)}`,
      source: "book", lesson, type, section, english, tanglish, tamil: "",
      register: "colloquial",                                 // the book teaches spoken Tamil
      ...(type === "dialogue" ? { speaker: label.slice(0, 1) } : {}),
      ...(alternates.length ? { alternates } : {}),
      needs_review: true, tags: ["missing-tamil", ...(repair?.tags ?? [])],
    });
  }
  return items;
}

function isLessonHeading(line: PdfLine, n: number): boolean {
  return new RegExp(`^\\s*LESSON\\s+${n}\\b\\.?\\s*$`).test(line.map((p) => p.text).join(""));
}
