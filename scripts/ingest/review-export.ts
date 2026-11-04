// Writes data/review-for-teacher.csv: every item marked needs_review, for the
// teacher to check in Excel or Google Sheets. She fills in the last two columns;
// her answers then go back into lessons/overrides.json.
//
//   npm run review-export
import { readFileSync, writeFileSync } from "node:fs";
import type { Item } from "./parse.ts";

const { items } = JSON.parse(readFileSync("data/lessons.json", "utf8")) as { items: Item[] };
const cell = (s = "") => `"${s.replace(/"/g, '""')}"`;

const rows = [["id", "from", "english", "tanglish (shown in app)", "tamil (what the voice reads)", "teacher's original tamil", "other accepted answers", "OK? (yes/no)", "correction"]];
for (const i of items.filter((i) => i.needs_review)) {
  rows.push([
    i.id,
    i.source === "book" ? `Adi's Book lesson ${i.lesson}` : `Lesson ${i.lesson}`,
    (i.speaker ? `${i.speaker}: ` : "") + i.english,
    i.tanglish,
    i.tamil,
    i.formal?.tamil ?? "",
    (i.alternates ?? []).map((a) => `${a.tanglish} = ${a.tamil}`).join("; "),
    "", "",
  ]);
}
// The byte-order mark makes Excel read the file as UTF-8, so Tamil displays correctly.
writeFileSync("data/review-for-teacher.csv", "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n"));
console.log(`Wrote data/review-for-teacher.csv (${rows.length - 1} items to review)`);
