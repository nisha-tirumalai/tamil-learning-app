// Reads the lesson files in lessons/ and writes data/lessons.json.
//
//   npm run ingest                 all lessons
//   npm run ingest -- --lesson 1   just Lesson 1
//   npm run ingest -- --dump 1     print Lesson 1's raw lines (for debugging)
//   npm run ingest -- --book-dump 1  print the book's Lesson 1 lines («» = romanized Tamil)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseBookLesson } from "./book.ts";
import { readDocx } from "./docx.ts";
import { parseLesson, type Item, type Resource, type ReviewNote } from "./parse.ts";
import { readPdf } from "./pdf.ts";

// Adi's Book lessons to include. Added a few at a time, because its Tamil
// script is written by Claude and has to be checked by the teacher.
const BOOK = "lessons/other-resources-Tamil-Teaching-Adis-Book-9.4.07pdf.pdf";
const BOOK_LESSONS = [1];

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : undefined; };
const only = flag("--lesson");
const dump = flag("--dump");
const bookDump = flag("--book-dump");

if (bookDump) {
  const lines = readPdf(BOOK).flat();
  const at = lines.findIndex((l) => new RegExp(`^\\s*LESSON\\s+${bookDump}\\b`).test(l.map((p) => p.text).join("")));
  const next = lines.findIndex((l, i) => i > at && /^\s*LESSON\s+\d+/.test(l.map((p) => p.text).join("")));
  for (const l of lines.slice(at, next)) console.log(l.map((p) => (p.kind === "tl" ? `«${p.text}»` : p.text)).join(""));
  process.exit(0);
}

const files = readdirSync("lessons")
  .map((f) => ({ file: f, lesson: Number(f.match(/^lesson_(\d+)\.docx$/i)?.[1]) }))
  .filter((f) => f.lesson && (!only || f.lesson === only) && (!dump || f.lesson === dump))
  .sort((a, b) => a.lesson - b.lesson);

if (dump) {
  for (const b of readDocx(join("lessons", files[0].file)))
    console.log(b.kind === "row" ? `  ROW: ${b.cells.join(" || ")}` : b.text);
  process.exit(0);
}

const items: Item[] = [], resources: Resource[] = [], review: ReviewNote[] = [];
for (const { file, lesson } of files) {
  const r = parseLesson(lesson, readDocx(join("lessons", file)));
  items.push(...r.items); resources.push(...r.resources); review.push(...r.review);
  console.log(`Lesson ${lesson}: ${r.items.length} items, ${r.duplicates} duplicates dropped, ${r.review.length} lines to review`);
}
const bookLessons = only || !existsSync(BOOK) ? [] : BOOK_LESSONS;
if (bookLessons.length) {
  const pages = readPdf(BOOK);
  for (const n of bookLessons) {
    const bookItems = parseBookLesson(pages, n);
    items.push(...bookItems);
    console.log(`Book lesson ${n}: ${bookItems.length} items`);
  }
}

// Corrections (e.g. spoken Tamil matching the Tanglish) live in lessons/overrides.json,
// keyed by item id, so they survive re-running this script.
// "checked: true" means a person looked at a flagged item and it's fine as is.
type Override = Partial<Pick<Item, "english" | "tanglish" | "tamil" | "register" | "alternates">> & { checked?: boolean };
const overrides: Record<string, Override> = existsSync("lessons/overrides.json")
  ? JSON.parse(readFileSync("lessons/overrides.json", "utf8")) : {};
let applied = 0;
for (const item of items) {
  const o = overrides[item.id];
  if (!o) continue;
  const { checked, ...changes } = o;
  if (changes.tamil && item.tamil && changes.tamil !== item.tamil) item.formal = { tamil: item.tamil };
  Object.assign(item, changes);
  if (Object.keys(changes).length) item.needs_review = true;        // anything we wrote needs the teacher
  if (changes.tamil) item.tags = item.tags.filter((t) => t !== "missing-tamil");
  const cleared = ["tanglish-tamil-mismatch", "check-register", "check-alignment", "missing-tanglish"];
  if (checked || changes.tamil || changes.tanglish) item.tags = item.tags.filter((t) => !cleared.includes(t));
  applied++;
}
const parsedIds = new Set(items.map((i) => i.id));
const prefixes = [...files.map((f) => `L${String(f.lesson).padStart(2, "0")}-`), ...bookLessons.map((n) => `B${String(n).padStart(2, "0")}-`)];
const lost = Object.keys(overrides).filter((id) => !parsedIds.has(id) && prefixes.some((p) => id.startsWith(p)));
if (applied) console.log(`Applied ${applied} overrides`);
if (lost.length) console.warn(`WARNING: overrides for missing items (did the lesson text change?): ${lost.join(", ")}`);
const noTamil = items.filter((i) => !i.tamil);
if (noTamil.length) console.warn(`${noTamil.length} items have no Tamil script yet (tagged missing-tamil); they can't have audio until it's added.`);

mkdirSync("data", { recursive: true });
const lessons = files.map((f) => f.lesson);
writeFileSync("data/lessons.json", JSON.stringify({ generatedAt: new Date().toISOString(), lessons, bookLessons, items, resources }, null, 2));
writeFileSync("data/review.json", JSON.stringify(review, null, 2));

const count = (key: (i: Item) => string) =>
  Object.entries(items.reduce<Record<string, number>>((acc, i) => ({ ...acc, [key(i)]: (acc[key(i)] ?? 0) + 1 }), {}))
    .map(([k, v]) => `${k} ${v}`).join(", ");
console.log(`\nTotal ${items.length} items`);
console.log(`By type:     ${count((i) => i.type)}`);
console.log(`By register: ${count((i) => i.register)}`);
console.log(`Flagged:     ${items.filter((i) => i.tags.includes("check-register")).length} check-register, ${items.filter((i) => i.tags.includes("check-order")).length} check-order`);
console.log(`Resources:   ${resources.length} links`);
console.log(`Wrote data/lessons.json and data/review.json`);
