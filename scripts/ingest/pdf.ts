// Reads "Common Spoken Tamil Made Easy" (Adi's Book). Like zip.ts, it uses
// only Node's built-in zlib.
//
// The book's romanized Tamil is set in fonts that store glyph numbers, not
// letters: in font R30 every character is its letter minus 29 ("DPP" = "amm"),
// and font R32 holds the accented letters (ā ī ū ē ō ṇ ḷ ḻ). Font R8 is plain
// text (the English). So each line comes back split into "tanglish" and
// "english" pieces according to the font they were printed in.
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

export type Piece = { kind: "tl" | "en"; text: string };
export type PdfLine = Piece[];

const ACCENTS: Record<number, string> = {
  0x97: "ā", 0xaf: "ī", 0xcc: "ū", 0x9d: "ē", 0xc0: "ō", 0xbc: "ṇ", 0xba: "ḷ", 0xc4: "ḻ",
  0x96: "Ā", 0xbb: "Ṇ", 0xb9: "Ḷ", 0x9c: "Ē", 0xbf: "Ō",
};
// After the -29 shift a few glyphs land on these characters.
const SHIFTED_PUNCT: Record<string, string> = { "Ò": "‘", "Ó": "’" };

function unescape(s: string): string {
  return s.replace(/\\(\d{1,3}|.)/g, (_, c: string) =>
    /\d/.test(c) ? String.fromCharCode(parseInt(c, 8)) : ({ n: "\n", r: "", t: " ", b: "", f: "" } as Record<string, string>)[c] ?? c);
}

/** Every page's lines, in order. A new line starts whenever the text moves up or down. */
export function readPdf(path: string): PdfLine[][] {
  const buf = readFileSync(path);
  const raw = buf.toString("latin1");
  const pages: PdfLine[][] = [];

  for (const m of raw.matchAll(/stream\r?\n/g)) {
    const start = m.index! + m[0].length;
    let content: string;
    try { content = inflateSync(buf.subarray(start, raw.indexOf("endstream", start))).toString("latin1"); } catch { continue; }
    if (!/\bT[Jj]\b/.test(content)) continue;                 // not page text

    const lines: PdfLine[] = [];
    let line: PdfLine = [];
    let font = "";
    const operands: string[] = [];
    const newLine = () => { if (line.length) lines.push(line); line = []; };
    const add = (kind: Piece["kind"], text: string) => {
      const last = line.at(-1);
      if (last?.kind === kind) last.text += text; else line.push({ kind, text });
    };
    const show = (s: string) => {
      for (const ch of unescape(s)) {
        const c = ch.charCodeAt(0);
        if (font === "R30") add("tl", c === 3 ? " " : (ch => SHIFTED_PUNCT[ch] ?? ch)(String.fromCharCode(c + 29)));
        else if (font === "R32") add("tl", ACCENTS[c] ?? "");
        else add("en", c === 0x92 ? "’" : c === 0x96 ? "–" : c === 0x97 ? "—" : ch);
      }
    };

    for (const [tok] of content.matchAll(/\((?:\\.|[^\\)])*\)|\[(?:\((?:\\.|[^\\)])*\)|[^\]])*\]|\/[\w.+-]+|-?\d*\.?\d+|[A-Za-z*']+/g)) {
      if (tok === "Tf") { font = operands.at(-2)?.slice(1) ?? ""; operands.length = 0; }
      else if (tok === "Tm") { if (Math.abs(Number(operands.at(-1)) - y) > 2) newLine(); y = Number(operands.at(-1)); operands.length = 0; }
      else if (tok === "Td" || tok === "TD") { const dy = Number(operands.at(-1)); if (Math.abs(dy) > 2) newLine(); y += dy; operands.length = 0; }
      else if (tok === "T*" || tok === "'") newLine();
      else if (tok === "Tj") { show((operands.at(-1) ?? "()").slice(1, -1)); operands.length = 0; }
      else if (tok === "TJ") {
        for (const [p] of (operands.at(-1) ?? "[]").matchAll(/\((?:\\.|[^\\)])*\)/g)) show(p.slice(1, -1));
        operands.length = 0;
      } else operands.push(tok);
    }
    newLine();
    pages.push(lines.map((l) => l.map((p) => ({ ...p, text: p.text.replace(/\s+/g, " ") })).filter((p) => p.text.trim())).filter((l) => l.length));
  }
  return pages;
}
let y = 0;
