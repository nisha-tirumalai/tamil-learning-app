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
  lesson: number;
  type: ItemType;
  section: string;
  english: string;
  tanglish: string;
  tamil: string; // stored for text-to-speech only, never shown in the app
  register: Register;
  speaker?: string;
  meaning?: { tamil: string; tanglish: string }; // Thirukkural explanation
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
  s.replace(/^[\s•·*|:–—-]+/, "").replace(/^\d+\s*[.)]\s*/, "")
    .replace(/\s*\d+\s*\.\s*$/, "").replace(/[\s|:–—-]+$/, "").trim();

// ---------- English vs Tanglish ----------

// Rough score: positive looks like English, negative looks like Tanglish.
const EN_WORDS = /\b(the|a|an|is|are|am|was|were|you|i|i'm|i’m|to|of|and|in|on|it|my|your|what|why|how|when|did|do|does|will|this|that|he|she|we|they|for|with|me|have|has|not|be|there|here|please|tense|day|time)\b/gi;
const TA_HINTS = /aa|ee|zh|[āēīōūṭḍṇḷṟñ]|\b(naan|nee|neenga|enna|romba|saar|sari|illa|unga|enakku|kizhamai|kaalam)\b|(kiren|giren|kiraai|giraay|kirathu|anum|unga)\b/gi;
export const englishness = (s: string) => (s.match(EN_WORDS)?.length ?? 0) - (s.match(TA_HINTS)?.length ?? 0);

// Given the layout's usual order, swap only if the text clearly disagrees.
function orient(english: string, tanglish: string): [string, string] {
  return englishness(tanglish) > englishness(english) ? [tanglish, english] : [english, tanglish];
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
const TL_COLLOQUIAL = /\b(romba|nallaa?|irukk(en|u)|illa|unga|neenga|kitta|ippo|appo|eppo|maadiri|padichu|kathukk\w*)\b|\w(nga|ren|reen|nnu|chu)\b/gi;
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
  [/thirukkural|kural/i, "kural"],
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
  let pending: { english: string; tamil: string; speaker?: string } | null = null;
  let kural = { tamil: [] as string[], tanglish: [] as string[], meaningTa: "", meaningTl: "", chapter: "", expectMeaning: false };
  let skipped = 0;
  let tableCols: { english: number; tanglish: number; tamil: number } | null = null;

  const note = (reason: string, text: string) => { if (mode === "skip") skipped++; else review.push({ lesson, section, reason, text }); };
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  function emit(english: string, tanglish: string, tamil: string, opts: Partial<Item> = {}) {
    english = clean(english); tanglish = clean(tanglish); tamil = clean(tamil);
    if (mode === "skip") { skipped++; return; }
    if (!english || !tanglish || !tamil) return note("missing a part", [english, tanglish, tamil].join(" | "));

    let speaker = opts.speaker;
    const who = english.match(/^([A-Z][A-Za-z ]{0,20}):\s*(.+)$/);
    if (who) { speaker = who[1]; english = who[2]; }

    const key = tamil.replace(/[^஀-௿]/g, "");
    if (seen.has(key)) { duplicates++; return; }
    seen.add(key);

    const type = (opts.type ?? mode) as ItemType;
    const fallback: Register = type === "dialogue" ? "colloquial" : "formal";
    const { register, unsure } = type === "kural" ? { register: "formal" as Register, unsure: false } : registerOf(tamil, fallback);
    const tags = [...(opts.tags ?? []), ...(sub ? [slug(sub)] : [])];
    if (unsure) tags.push("check-register");
    // Audio is made from the Tamil script, so it must say what the Tanglish says.
    const tl = tanglishRegister(tanglish);
    if (tl && register !== "neutral" && tl !== register) tags.push("tanglish-tamil-mismatch");
    if (englishness(tanglish) > englishness(english)) tags.push("check-order");

    items.push({
      id: `L${String(lesson).padStart(2, "0")}-${createHash("sha1").update(key).digest("hex").slice(0, 8)}`,
      lesson, type, section, english, tanglish, tamil, register,
      ...(speaker ? { speaker } : {}), ...(opts.meaning ? { meaning: opts.meaning } : {}), tags,
    });
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
    if (pending) { note("no Tanglish found", `${pending.english} | ${pending.tamil}`); pending = null; }
  }
  function finishKural() {
    if (kural.tamil.length && kural.tanglish.length && latinBuf.length) {
      // Last Latin line is the English meaning; any before it continue the Tanglish meaning.
      const english = latinBuf.at(-1)!;
      const meaningTl = [kural.meaningTl, ...latinBuf.slice(0, -1)].filter(Boolean).join(" ");
      emit(english, kural.tanglish.join(" "), kural.tamil.join(" "), {
        type: "kural", tags: ["classical"],
        meaning: { tamil: kural.meaningTa, tanglish: meaningTl },
      });
      latinBuf = [];
    } else if (kural.tamil.length) note("incomplete Thirukkural", kural.tamil.join(" "));
    kural = { tamil: [], tanglish: [], meaningTa: "", meaningTl: "", chapter: "", expectMeaning: false };
  }

  // Thirukkural blocks: chapter, 2-line verse, Tanglish, "Meaning <Tamil>", Tanglish meaning, English meaning.
  function kuralLine(text: string, runs: Run[]) {
    const hasTa = runs.some((r) => r.script === "ta");
    if (/^meaning\b/i.test(text)) {
      if (hasTa) kural.meaningTa = clean(runs.filter((r) => r.script === "ta").map((r) => r.text).join(" "));
      else kural.expectMeaning = true;                     // the Tamil meaning is on the next line
      return;
    }
    if (/^thiruvalluvar$/i.test(text)) return;
    if (hasTa && runs.length === 1 && (kural.expectMeaning || (kural.meaningTa && !kural.meaningTl))) {
      kural.meaningTa = [kural.meaningTa, text].filter(Boolean).join(" "); // may span two lines
      kural.expectMeaning = false;
      return;
    }
    if (hasTa && runs.length === 1) {
      if (!kural.tamil.length && text.split(/\s+/).length <= 3) kural.chapter = text;
      else if (kural.tanglish.length) { finishKural(); kural.tamil.push(text); }
      else kural.tamil.push(text);
      return;
    }
    if (!hasTa) {
      if (!kural.tamil.length) return;                     // introduction text
      if (kural.meaningTa && !kural.meaningTl) kural.meaningTl = text;
      else if (kural.meaningTa) latinBuf.push(text);       // English meaning
      else kural.tanglish.push(text);
      return;
    }
    note("unexpected line in Thirukkural", text);
  }

  for (const block of blocks) {
    if (block.kind === "row") {
      tableRow(block.cells, block.first);
      continue;
    }
    const text = block.text;
    const runs = splitScripts(text);

    const url = text.match(/https?:\/\/\S+/);
    if (url) { resources.push({ lesson, url: url[0], after: section }); continue; }

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
    if (mode === "kural") { kuralLine(text, runs); continue; }
    lineToItems(text, runs);
  }
  flushAll();
  if (skipped) note("skipped (exercise / answer key)", `${skipped} lines`);
  return { items, resources, review, duplicates };

  // --- layouts ---

  function lineToItems(text: string, runs: Run[]) {
    const hasTa = runs.some((r) => r.script === "ta");
    const hasLa = runs.some((r) => r.script === "la");

    if (!hasTa) {
      // A speaker name on its own line, e.g. "Teacher:".
      const who = text.match(/^([A-Z][A-Za-z ]{0,20}):$/);
      if (who && mode === "dialogue") { speaker = who[1]; return; }
      // English or Tanglish on its own line.
      if (pending) { emit(pending.english, text, pending.tamil, { speaker: pending.speaker }); pending = null; }
      else latinBuf.push(text);
      return;
    }

    if (!hasLa) {
      // Tamil on its own line: the English and Tanglish came on the lines before it.
      const buf = latinBuf;
      latinBuf = [];
      if (buf.length >= 2) {
        if (buf.length > 2) { latinBuf = buf.slice(0, -2); flushBuffer(); }
        const [english, tanglish] = orient(buf.at(-2)!, buf.at(-1)!);
        emit(english, tanglish, text, { speaker });
      } else if (buf.length === 1) pending = { english: buf[0], tamil: text, speaker };
      else note("Tamil with no English nearby", text);
      speaker = undefined;
      return;
    }

    flushBuffer();
    if (pending) { note("no Tanglish found", `${pending.english} | ${pending.tamil}`); pending = null; }

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
      const looksLikeHeader = cells.every((c) => /^(english|tamil|tanglish|tamil in english|meaning|transliteration|pronunciation)$/i.test(c));
      if (looksLikeHeader) { tableCols = headerColumns(cells); return; }
      tableCols = null;
    }
    const ta = cells.findIndex((c) => [...c].some(isTamil));
    if (ta < 0) return note("table row with no Tamil", cells.join(" || "));
    let english = "", tanglish = "";
    if (tableCols) { english = cells[tableCols.english] ?? ""; tanglish = cells[tableCols.tanglish] ?? ""; }
    else {
      const latin = cells.filter((_, i) => i !== ta);
      [english, tanglish] = orient(latin[0] ?? "", latin[1] ?? "");
    }
    emit(english, tanglish, cells[tableCols?.tamil ?? ta], { type: "vocab" });
  }
}

function headerColumns(cells: string[]) {
  const find = (re: RegExp) => cells.findIndex((c) => re.test(c));
  const tanglish = find(/tanglish|in english|translit|pronunc/i);
  const english = cells.findIndex((c, i) => i !== tanglish && /english|meaning/i.test(c));
  const tamil = cells.findIndex((c, i) => i !== tanglish && /tamil/i.test(c));
  return { english, tanglish, tamil };
}
