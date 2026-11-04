// Turns the blocks of one lesson into practice items.
//
// The lessons use several layouts (separate lines, "a | b | c", "a – b – c",
// all three run together, tables). Rather than one rule per layout, we split
// every line wherever the writing switches between Tamil script and Latin
// letters. Where the Tamil part sits tells us how to read the Latin parts.
import { createHash } from "node:crypto";
import type { Block } from "./docx.ts";

export type ItemType = "sentence" | "vocab" | "dialogue" | "story" | "grammar" | "kural" | "song";
export type Register = "colloquial" | "formal" | "neutral";

export interface Item {
  id: string;
  source?: "book";                               // absent = the teacher's lesson files
  lesson: number;
  type: ItemType;
  section: string;
  english: string;
  tanglish: string;
  tamil: string; // stored for text-to-speech only, never shown in the app
  register: Register;
  speaker?: string;
  meaning?: { tamil: string; tanglish: string }; // Thirukkural explanation
  formal?: { tamil: string };                    // teacher's written version when 'tamil' is the spoken one
  alternates?: { tanglish: string; tamil: string }[]; // other accepted answers
  pair_id?: string;                              // links a formal line to its spoken version
  needs_review: boolean;                         // true for anything not straight from the teacher's files
  tags: string[];
}
export interface Resource { lesson: number; url: string; after: string; before?: string }
export interface ReviewNote { lesson: number; section: string; reason: string; text: string }

export interface LessonResult { items: Item[]; resources: Resource[]; review: ReviewNote[]; duplicates: number }

// ---------- script splitting ----------

type Run = { script: "ta" | "la"; text: string };
const isTamil = (ch: string) => ch >= "஀" && ch <= "௿";
const isLatin = (ch: string) => /\p{Script=Latin}/u.test(ch);

// Spaces, digits and punctuation belong to whichever run they follow.
export function splitScripts(text: string): Run[] {
  const runs: Run[] = [];
  let lead = "";
  for (const ch of text) {
    const script = isTamil(ch) ? "ta" : isLatin(ch) ? "la" : null;
    const last = runs.at(-1);
    if (!script) { if (last) last.text += ch; else lead += ch; }
    else if (last?.script === script) last.text += ch;
    else { runs.push({ script, text: lead + ch }); lead = ""; }
  }
  return runs;
}

const SEP = /\s*(?:\||–|—|\s-\s)\s*/;
const clean = (s: string) =>
  s.replace(/[​-‍﻿]/g, "").replace(/^[\s•·*|:–—→-]+/, "").replace(/^\d+\s*[.)]\s*/, "")
    .replace(/\s*\d+\s*\.\s*$/, "").replace(/[\s|:–—→-]+$/, "").trim()
    .replace(/^\(([^()]*)\)$/, "$1");                     // "(இது நூறு ரூபாய்)" → the words inside

// ---------- English vs Tanglish ----------

// Rough score: positive looks like English, negative looks like Tanglish.
const EN_WORDS = /\b(the|a|an|is|are|am|was|were|you|i|i'm|i’m|to|of|and|in|on|it|my|your|what|why|how|when|did|do|does|will|this|that|he|she|we|they|for|with|me|have|has|not|be|there|here|please|tense|day|time)\b/gi;
const TA_HINTS = /aa|ee|zh|[āēīōūṭḍṇḷṟñ]|\b(naan|nee|neenga|enna|romba|saar|sari|illa|unga|enakku|kizhamai|kaalam)\b|(kiren|giren|kiraai|giraay|kirathu|anum|unga)\b/gi;
export const englishness = (s: string) => (s.match(EN_WORDS)?.length ?? 0) - (s.match(TA_HINTS)?.length ?? 0);

// Could this line be the Tanglish for an English line we already have?
// Rejects a second English sentence and Title Case headings like "Polite Expressions".
function couldBeTanglish(s: string, english: string): boolean {
  const score = englishness(s);
  if (score > 0 && score >= englishness(english)) return false;
  const words = s.split(/[\s/&]+/).filter(Boolean);
  const hints = s.match(TA_HINTS)?.length ?? 0;
  const heading = words.length >= 2 && words.every((w) => /^[A-Z]/.test(w)) && !/[.,?!]/.test(s);
  return hints > 0 || !heading;
}

// Could this Latin line just before a Tamil line be that line's English?
// It must not sound like the Tamil (that would be Tanglish) and must not be a heading.
function couldBeEnglishFor(s: string, tamil: string): boolean {
  if (s.split(/\s+/).length <= 3 && /:$/.test(s)) return false; // a heading like "Past Tense:"
  return englishness(s) >= 1 || soundsAlike(s, tamil) < ALIGN_THRESHOLD;
}
// Is this line, rather than the other one, the Tanglish for this Tamil?
function isTanglishFor(s: string, other: string, tamil: string): boolean {
  return soundsAlike(s, tamil) >= ALIGN_THRESHOLD && englishness(s) < 1 && englishness(s) <= englishness(other);
}

// Given the layout's usual order, swap only if the text clearly disagrees.
function orient(english: string, tanglish: string): [string, string] {
  return englishness(tanglish) > englishness(english) ? [tanglish, english] : [english, tanglish];
}

// ---------- does the Tanglish say the same thing as the Tamil? ----------

// Reduce both to a rough consonant "skeleton" so spelling differences
// (th/dh/t, zh/l, doubled letters, long vowels) don't matter, then compare.
const TA_SOUND: Record<string, string> = {
  "க": "k", "ங": "n", "ச": "s", "ஞ": "n", "ட": "t", "ண": "n", "த": "t", "ந": "n", "ப": "p", "ம": "m",
  "ய": "y", "ர": "r", "ல": "l", "வ": "v", "ழ": "l", "ள": "l", "ற": "r", "ன": "n",
  "ஜ": "s", "ஷ": "s", "ஸ": "s", "ஹ": "h", "ஃ": "",
};
function tamilSkeleton(ta: string): string {
  // ன்ற is said "ndr" and ற்ற is said "tr" (நன்றி = nandri, வெற்றி = vetri).
  ta = ta.replace(/ன்ற/g, "ntr").replace(/ற்ற/g, "tr");
  return [...ta].map((ch) => TA_SOUND[ch] ?? (/[\s\w]/.test(ch) ? ch.toLowerCase() : "")).join("");
}
function latinSkeleton(tl: string): string {
  return tl.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/zh/g, "l").replace(/[td]h?/g, "t").replace(/ch|sh|[cjsz]/g, "s").replace(/[kgq]h?/g, "k")
    .replace(/[pbf]h?/g, "p").replace(/w/g, "v").replace(/x/g, "ks")
    .replace(/[^a-z\s]/g, "").replace(/[aeiou]/g, "");
}
const collapse = (s: string) => s.replace(/\s+/g, " ").replace(/(\w)\1+/g, "$1").trim();
function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = s.replace(/\s/g, "");
  for (let i = 0; i < t.length - 1; i++) m.set(t.slice(i, i + 2), (m.get(t.slice(i, i + 2)) ?? 0) + 1);
  return m;
}
export const ALIGN_THRESHOLD = 0.35;
// 1 = sounds identical, 0 = nothing in common.
export function soundsAlike(tanglish: string, tamil: string): number {
  const a = bigrams(collapse(latinSkeleton(tanglish))), b = bigrams(collapse(tamilSkeleton(tamil)));
  let shared = 0, total = 0;
  for (const [k, v] of a) { shared += Math.min(v, b.get(k) ?? 0); total += v; }
  for (const v of b.values()) total += v;
  return total ? (2 * shared) / total : 1;
}

// ---------- formal vs spoken ----------

// Word endings and words that mark spoken (colloquial) vs written (formal) Tamil.
const END = "(?=[\\s.,?!\"”’]|$)";
const COLLOQUIAL = new RegExp(
  [`ங்க${END}`, "ரொம்ப", "நல்லா", "க்கேன்", `இருக்கு${END}`, "ணும்", `லாம்${END}`, `இல்ல${END}`,
   "ன்னு", "கிட்ட", "(?<!கி)றேன்", "றீங்க", "றாங்க", `(?:க|ர)லை${END}`, `இப்ப${END}`, "அப்போ", "எப்போ", "மாத்த", "பாத்த", "ச்சு"].join("|"), "g");
const FORMAL = new RegExp(
  ["கிறாய்", "கிறேன்", "கிறது", "கிறான்", "கிறாள்", "கிறார்", "கின்ற", "கிறோம்", "வில்லை",
   `மாக${END}`, `தல்${END}`, "ஆனால்", "அதனால்", "என்று"].join("|"), "g");

export function registerOf(tamil: string, fallback: Register): { register: Register; unsure: boolean } {
  const c = tamil.match(COLLOQUIAL)?.length ?? 0;
  const f = tamil.match(FORMAL)?.length ?? 0;
  const words = tamil.split(/\s+/).length;
  if (c > f) return { register: "colloquial", unsure: f > 0 };
  if (f > c) return { register: "formal", unsure: c > 0 };
  // No markers: single words are neutral; longer phrases need a human look.
  return { register: words <= 2 ? "neutral" : fallback, unsure: words > 2 || c > 0 };
}

// The same check on the Tanglish. Teachers often write the Tanglish the way
// people talk even when the Tamil script is the formal version.
const TL_COLLOQUIAL = /\b(romba|nallaa?|irukk(en|u)|illa|unga|neenga|kitta|ippo|appo|eppo|maadiri|padichu|kathukk\w*)\b|\w(nga|nnu|chu)\b|(?<!ki|gi|ki[rṟ]|gi[rṟ])(ren|reen|raen)\b/gi;
const TL_FORMAL = /(kiraai|kiraay|giraay|kirathu|kiradhu|kiren|kirēn|girēn|kindrana|villai|aaga|endru|migundha|magizhchi)\b/gi;
function tanglishRegister(tanglish: string): Register | null {
  const c = tanglish.match(TL_COLLOQUIAL)?.length ?? 0;
  const f = tanglish.match(TL_FORMAL)?.length ?? 0;
  return c > f ? "colloquial" : f > c ? "formal" : null;
}

// ---------- sections ----------

type Mode = ItemType | "skip";
const SECTIONS: [RegExp, Mode][] = [
  [/fill in the blanks|answer key|exercise|homework/i, "skip"],
  [/thirukkural|kural|குறள்/i, "kural"],
  [/song|பாடல்/i, "song"],
  [/conversation|dialogue|உரையாடல்/i, "dialogue"],
  [/grammar|இலக்கணம்/i, "grammar"],
  [/translation|story|கதை/i, "story"],
  [/vocabular|writing|days|months|numbers|colou?rs|body parts|animals|fruits|vegetables|family|relations/i, "vocab"],
];

function sectionHeading(text: string, runs: Run[]): Mode | null {
  const oneScript = runs.length === 1;
  const short = runs[0]?.script === "la" ? text.length <= 80 : text.length <= 30;
  if (!oneScript || !short || /[.?!]$/.test(text)) return null;
  return SECTIONS.find(([re]) => re.test(text))?.[1] ?? null;
}

// ---------- the parser ----------

export function parseLesson(lesson: number, blocks: Block[]): LessonResult {
  const items: Item[] = [];
  const resources: Resource[] = [];
  const review: ReviewNote[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  let section = "Sentences";
  let mode: Mode = "sentence";
  let sub = "";                       // sub-heading like "Past Tense" or "to eat"
  let speaker: string | undefined;    // dialogue speaker given on its own line
  let latinBuf: string[] = [];        // Latin-only lines waiting for their Tamil line
  let pending: { english: string; tamil: string; speaker?: string } | null = null;   // waiting for Tanglish
  let tamilFirst: { tamil: string; latin: string[]; speaker?: string } | null = null; // waiting for English + Tanglish
  let awaitEnglish: { tanglish: string; tamil: string; speaker?: string } | null = null; // waiting for English
  let kuralLines: string[] = [];      // the whole Thirukkural section, sorted out at the end
  let arrowLines: { text: string; ta: boolean }[] = []; // "formal → spoken" pairs, three lines per pair
  let skipped = 0;
  let tableCols: { english: number; tanglish: number; tamil: number; number: number } | null = null;

  const note = (reason: string, text: string) => { if (mode === "skip") skipped++; else review.push({ lesson, section, reason, text }); };
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  function emit(english: string, tanglish: string, tamil: string, opts: Partial<Item> = {}): Item | undefined {
    english = clean(english); tanglish = clean(tanglish); tamil = clean(tamil);
    if (mode === "skip") { skipped++; return; }
    const missingTanglish = !tanglish && opts.tags?.includes("missing-tanglish");
    if (!english || (!tanglish && !missingTanglish) || !tamil) return note("missing a part", [english, tanglish, tamil].join(" | "));

    if (/_{2,}/.test(english + tanglish + tamil)) { skipped++; return; } // fill-in-the-blank exercise
    if (/[(+]$/.test(english) || /^worksheet\b/i.test(tanglish)) return note("grammar note, not a phrase", [english, tanglish, tamil].join(" | "));

    let speaker = opts.speaker;
    const who = english.match(/^([A-Z][A-Za-z ]{0,20}):\s*(.+)$/);
    if (who) { speaker = who[1]; english = who[2]; }
    // In dialogues the Tamil and Tanglish may repeat the speaker ("கலா: …", "Mala: …").
    // Text-to-speech would read the name aloud, so drop it.
    if (mode === "dialogue" || speaker) {
      tamil = tamil.replace(/^[஀-௿]+\s*:\s*/, "");
      tanglish = tanglish.replace(/^[A-Z][a-z]+:\s*/, "");
    }

    // Whichever side sounds like the Tamil is the Tanglish. This beats guessing
    // from layout, e.g. "Moonru | Three" vs "Three | Moonru".
    if (tanglish && soundsAlike(english, tamil) > soundsAlike(tanglish, tamil) + 0.2) [english, tanglish] = [tanglish, english];

    const key = tamil.replace(/[^஀-௿]/g, "");
    if (seen.has(key)) { duplicates++; return; }
    seen.add(key);

    let type = (opts.type ?? mode) as ItemType;
    // Word lists often sit under conversation or story headings.
    if ((type === "dialogue" || type === "story") && tamil.split(/\s+/).length <= 2 && !/[.?!]$/.test(english)) type = "vocab";
    const fallback: Register = type === "dialogue" ? "colloquial" : "formal";
    const { register, unsure } = opts.register ? { register: opts.register, unsure: false }
      : type === "kural" ? { register: "formal" as Register, unsure: false } : registerOf(tamil, fallback);
    const tags = [...(opts.tags ?? []), ...(sub ? [slug(sub)] : [])];
    if (unsure) tags.push("check-register");
    // Audio is made from the Tamil script, so it must say what the Tanglish says.
    const tl = tanglishRegister(tanglish);
    if (tl && register !== "neutral" && tl !== register) tags.push("tanglish-tamil-mismatch");
    if (englishness(tanglish) > englishness(english)) tags.push("check-order");
    if (tanglish && soundsAlike(tanglish, tamil) < ALIGN_THRESHOLD) tags.push("check-alignment");

    const item: Item = {
      id: `L${String(lesson).padStart(2, "0")}-${createHash("sha1").update(key).digest("hex").slice(0, 8)}`,
      lesson, type, section, english, tanglish, tamil, register,
      ...(speaker ? { speaker } : {}), ...(opts.meaning ? { meaning: opts.meaning } : {}),
      needs_review: missingTanglish, tags,
    };
    items.push(item);
    return item;
  }

  // "I don't understand. → I didn't get it." then the Tamil and Tanglish lines in the
  // same shape. The left side is formal, the right side is how people say it.
  function arrowLine(text: string, ta: boolean) {
    arrowLines.push({ text, ta });
    if (arrowLines.length < 3) return;
    const group = arrowLines;
    arrowLines = [];
    const tamilLine = group.find((l) => l.ta);
    const latin = group.filter((l) => !l.ta).map((l) => l.text);
    if (!tamilLine || latin.length !== 2) return note("formal → spoken group didn't have one Tamil line", group.map((l) => l.text).join(" / "));
    const [en, tl] = orient(latin[0], latin[1]);
    const split = (s: string) => s.split(/\s*→\s*/);
    const [enF, enS] = split(en), [tlF, tlS] = split(tl), [taF, taS] = split(tamilLine.text);
    if (!enS || !tlS || !taS) return note("formal → spoken line missing a side", group.map((l) => l.text).join(" / "));
    const formal = emit(enF, tlF, taF, { register: "formal" });
    const spoken = emit(enS, tlS, taS, { register: "colloquial" });
    if (formal && spoken) formal.pair_id = spoken.pair_id = formal.id;
  }

  // Some lessons give only English + Tamil. Keep the line, flagged, so the
  // Tanglish can be added in lessons/overrides.json.
  function finishPendingWithoutTanglish(phraseList = false) {
    if (!pending) return;
    const sentenceLike = ["dialogue", "story", "sentence"].includes(mode) && !/[(+]$/.test(pending.english) && !/^lesson\b/i.test(pending.english);
    if (phraseList || (sentenceLike && (englishness(pending.english) > 0 || pending.english.split(/\s+/).length >= 2)))
      emit(pending.english, "", pending.tamil, { speaker: pending.speaker, tags: ["missing-tanglish"] });
    else note("no Tanglish found", `${pending.english} | ${pending.tamil}`);
    pending = null;
  }

  // Leftover Latin lines are headings or notes, not content.
  function flushBuffer() {
    const last = latinBuf.filter((l) => l.length <= 40 && !/[.?!]$/.test(l)).at(-1);
    if (last) sub = clean(last);
    latinBuf = [];
  }
  function flushAll() {
    finishKural();
    flushBuffer();
    finishPendingWithoutTanglish();
    if (tamilFirst) { note("Tamil with no English nearby", tamilFirst.tamil); tamilFirst = null; }
    if (awaitEnglish) { note("no English found", `${awaitEnglish.tanglish} | ${awaitEnglish.tamil}`); awaitEnglish = null; }
    if (arrowLines.length) { note("unfinished formal → spoken group", arrowLines.map((l) => l.text).join(" / ")); arrowLines = []; }
  }
  // Each lesson orders its Thirukkural differently, so collect the whole section
  // and sort the lines by script: the first block of Tamil lines is the verse,
  // later Tamil is its meaning; Tanglish-looking lines go with whichever Tamil
  // block they follow (or precede, for the verse); the first English-looking
  // line after the verse starts is the English meaning.
  function finishKural() {
    const lines = kuralLines.filter((l) => !/^(thiruvalluvar|meaning)$/i.test(l)).map((l) => l.replace(/^meaning\s*/i, ""));
    kuralLines = [];
    if (!lines.length) return;

    const isTa = (l: string) => [...l].some(isTamil);
    const firstTa = lines.findIndex(isTa);
    if (firstTa < 0) return note("Thirukkural with no Tamil", lines.join(" / "));
    // A short Tamil line just before the verse is its chapter name.
    let start = firstTa;
    if (lines[start].split(/\s+/).length <= 3 && isTa(lines[start + 1] ?? "")) start++;
    let verseEnd = start;
    while (verseEnd < lines.length && isTa(lines[verseEnd])) verseEnd++;
    const verse = lines.slice(start, verseEnd);
    const meaningStart = lines.findIndex((l, i) => i >= verseEnd && isTa(l));

    const tanglishVerse: string[] = [], tanglishMeaning: string[] = [], tamilMeaning: string[] = [];
    let english = "";
    let verseBegun = false;
    lines.forEach((l, i) => {
      if (i >= start && i < verseEnd) { verseBegun = true; return; }
      if (isTa(l)) { if (i > verseEnd) tamilMeaning.push(l); return; }
      const looksEnglish = englishness(l) > 0;
      if (!looksEnglish) {
        verseBegun = true;
        (meaningStart >= 0 && i > meaningStart ? tanglishMeaning : tanglishVerse).push(l);
      } else if (verseBegun && !english) english = l;     // English before the verse is an introduction
    });
    if (meaningStart >= 0 && !tamilMeaning.length) tamilMeaning.push(lines[meaningStart]);

    if (!verse.length || !tanglishVerse.length || !english)
      return note("incomplete Thirukkural", lines.join(" / "));
    emit(english, tanglishVerse.join(" "), verse.join(" "), {
      type: "kural", tags: ["classical"],
      meaning: { tamil: tamilMeaning.join(" "), tanglish: tanglishMeaning.join(" ") },
    });
  }

  for (const block of blocks) {
    if (block.kind === "row") {
      tableRow(block.cells, block.first);
      continue;
    }
    let text = block.text;
    let runs = splitScripts(text);

    // A link may share a line with a heading, e.g. "1.திருக்குறள் https://youtu.be/…".
    const url = text.match(/https?:\/\/\S+/);
    if (url) {
      resources.push({ lesson, url: url[0], after: section });
      text = text.replace(url[0], "").trim();
      if (!text) continue;
      runs = splitScripts(text);
    }

    const heading = sectionHeading(text, runs);
    if (heading) {
      flushAll();
      for (const r of resources) if (r.lesson === lesson && !r.before) r.before = text;
      // Section names show in the app, so a Tamil-script heading gets an English name.
      const sameAsBefore = heading === mode;
      if (runs[0].script === "la") section = clean(text);
      else if (!sameAsBefore) section = heading[0].toUpperCase() + heading.slice(1);
      mode = heading; sub = "";
      continue;
    }
    if (mode === "kural") { kuralLines.push(text); continue; }
    if (!runs.length) continue;                            // just a number like "1."
    lineToItems(text, runs);
  }
  flushAll();
  if (skipped) note("skipped (exercise / answer key)", `${skipped} lines`);
  return { items, resources, review, duplicates };

  // --- layouts ---

  function lineToItems(text: string, runs: Run[]) {
    // "Mala: <Tamil>" — take the speaker off first, or the name looks like English.
    const who = text.match(/^([A-Z][A-Za-z]{0,15}(?: [A-Z][A-Za-z]{0,15})?):\s*(\S.*)$/);
    if (who && mode === "dialogue") { speaker = who[1]; text = who[2]; runs = splitScripts(text); }

    const hasTa = runs.some((r) => r.script === "ta");
    const hasLa = runs.some((r) => r.script === "la");

    if (text.includes("→") && runs.length === 1) { flushBuffer(); arrowLine(text, hasTa); return; }

    if (!hasTa) {
      // A speaker name on its own line, e.g. "Teacher:".
      const who = text.match(/^([A-Z][A-Za-z ]{0,20}):$/);
      if (who && mode === "dialogue") { speaker = who[1]; return; }
      // English or Tanglish on its own line (either order). Two English lines in
      // a row means this lesson gave no Tanglish for the earlier one.
      if (pending && !couldBeTanglish(text, pending.english)) finishPendingWithoutTanglish();
      if (awaitEnglish) {
        emit(text, awaitEnglish.tanglish, awaitEnglish.tamil, { speaker: awaitEnglish.speaker });
        awaitEnglish = null;
      } else if (pending) {
        const [english, tanglish] = orient(pending.english, text);
        emit(english, tanglish, pending.tamil, { speaker: pending.speaker });
        pending = null;
      } else if (tamilFirst) {
        // Tamil came first; its English and Tanglish are the next two lines.
        tamilFirst.latin.push(text);
        if (tamilFirst.latin.length < 2) return;
        const { tamil, latin, speaker: who } = tamilFirst;
        tamilFirst = null;
        if (Math.max(...latin.map((l) => soundsAlike(l, tamil))) >= ALIGN_THRESHOLD) emit(latin[0], latin[1], tamil, { speaker: who });
        else { note("Tamil with no English nearby", tamil); latinBuf.push(...latin); }
      } else latinBuf.push(text);
      return;
    }

    if (!hasLa) {
      // Tamil on its own line. Lessons put its English and Tanglish before it,
      // around it, or after it; the sound check tells us which.
      if (tamilFirst) note("Tamil with no English nearby", tamilFirst.tamil);
      if (awaitEnglish) note("no English found", `${awaitEnglish.tanglish} | ${awaitEnglish.tamil}`);
      tamilFirst = null; awaitEnglish = null;
      const buf = latinBuf;
      latinBuf = [];
      // "English" then "(Tamil)" with no Tanglish anywhere: a layout used for phrase lists.
      if (/^\(.*\)$/.test(text.trim()) && buf.length) {
        if (buf.length > 1) { latinBuf = buf.slice(0, -1); flushBuffer(); }
        pending = { english: buf.at(-1)!, tamil: text, speaker };
        finishPendingWithoutTanglish(true);
        speaker = undefined;
        return;
      }
      const before = buf.slice(-2);
      if (before.length === 2 && (isTanglishFor(before[0], before[1], text) || isTanglishFor(before[1], before[0], text))) {
        // English and Tanglish both came before the Tamil.
        if (buf.length > 2) { latinBuf = buf.slice(0, -2); flushBuffer(); }
        emit(before[0], before[1], text, { speaker });
      } else if (buf.length >= 1 && soundsAlike(buf.at(-1)!, text) >= ALIGN_THRESHOLD && englishness(buf.at(-1)!) < 1) {
        // Tanglish before, English after (e.g. numbered story lines).
        latinBuf = buf.slice(0, -1); flushBuffer();
        awaitEnglish = { tanglish: buf.at(-1)!, tamil: text, speaker };
      } else if (buf.length >= 1 && couldBeEnglishFor(buf.at(-1)!, text)) {
        // English before, Tanglish after. Anything earlier belongs to something
        // else; pairing it would shift every following item by one.
        if (buf.length >= 2 && buf.at(-2)!.length > 40) note("line not used", buf.at(-2)!);
        latinBuf = buf.slice(0, -1); flushBuffer();
        pending = { english: buf.at(-1)!, tamil: text, speaker };
      } else {
        latinBuf = buf; flushBuffer();
        tamilFirst = { tamil: text, latin: [], speaker };
      }
      speaker = undefined;
      return;
    }

    flushBuffer();
    finishPendingWithoutTanglish();
    if (tamilFirst) { note("Tamil with no English nearby", tamilFirst.tamil); tamilFirst = null; }

    // "Tamil (English)" is a heading, e.g. "செய் (to do)"; "Tamil (English) Tanglish" is a word.
    const gloss = text.match(/^[\d.\s]*([^()]+?)\s*\(([^()]+)\)\s*([^()]*)$/);
    if (gloss && ![...gloss[2] + gloss[3]].some(isTamil) && [...gloss[1]].some(isTamil) && ![...gloss[1]].some(isLatin)) {
      if (gloss[3]) emit(gloss[2], gloss[3], gloss[1].replace(/[“”"]/g, ""), { type: "vocab" });
      else sub = gloss[2];
      return;
    }

    if (runs[0].script === "ta") {
      // "Tamil | Tanglish | English", possibly several on one line.
      for (let i = 0; i < runs.length; i += 2) {
        const tamil = runs[i].text;
        const parts = (runs[i + 1]?.text ?? "").split(SEP).map(clean).filter(Boolean);
        if (parts.length >= 2) {
          const [english, tanglish] = orient(parts.slice(1).join(" – "), parts[0]);
          emit(english, tanglish, tamil);
        } else if (parts.length === 1 && /^\(.*\)$/.test(parts[0])) {
          sub = parts[0].slice(1, -1);                     // verb heading like "செய் (to do)"
        } else note("Tamil-first line without English and Tanglish", text);
      }
      return;
    }

    // "English Tamil Tanglish" (dialogues, stories, "English – Tamil – Tanglish" vocab).
    if (runs.length === 3) {
      if (englishness(runs[2].text) > englishness(runs[0].text) + 1) return note("English and Tanglish look swapped", text);
      emit(runs[0].text, runs[2].text, runs[1].text);
    } else if (runs.length === 2) {
      pending = { english: clean(runs[0].text), tamil: clean(runs[1].text) };
    } else note("too many script changes to split safely", text);
  }

  function tableRow(cells: string[], first: boolean) {
    if (first) {
      // e.g. "English || Tamil || Tanglish" or "Number || English Meaning || Tamil (தமிழ்)"
      const looksLikeHeader = cells.every((c) => /english|tamil|tanglish|thanglish|meaning|translit|pronunc|^(number|no\.?|#)$/i.test(c));
      if (looksLikeHeader) { tableCols = headerColumns(cells); return; }
      tableCols = null;
    }
    // Cells that each hold a whole "English – Tamil – Tanglish" entry.
    const whole = cells.filter((c) => [...c].some(isTamil) && [...c].some(isLatin) && SEP.test(c));
    if (whole.length && !tableCols) {
      for (const c of whole) lineToItems(c, splitScripts(c));
      return;
    }
    const ta = cells.findIndex((c) => [...c].some(isTamil));
    if (ta < 0) return note("table row with no Tamil", cells.join(" || "));
    let english = "", tanglish = "";
    if (tableCols) {
      english = cells[tableCols.english] ?? cells[tableCols.number] ?? "";
      tanglish = cells[tableCols.tanglish] ?? "";
    } else {
      const latin = cells.filter((_, i) => i !== ta);
      [english, tanglish] = orient(latin[0] ?? "", latin[1] ?? "");
    }
    emit(english, tanglish, cells[tableCols?.tamil ?? ta], { type: "vocab", tags: tanglish ? [] : ["missing-tanglish"] });
  }
}

function headerColumns(cells: string[]) {
  const find = (re: RegExp) => cells.findIndex((c) => re.test(c));
  const tanglish = find(/tanglish|thanglish|in english|translit|pronunc/i);
  const english = cells.findIndex((c, i) => i !== tanglish && /english|meaning/i.test(c));
  const tamil = cells.findIndex((c, i) => i !== tanglish && /tamil/i.test(c));
  const number = find(/^(number|no\.?|#)$/i);
  return { english, tanglish, tamil, number };
}
