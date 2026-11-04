// Turns a .docx into a flat list of "blocks": text lines and table rows,
// in document order. Formatting (bold, colours, images) is thrown away.
import { readFileSync } from "node:fs";
import { readZipEntry } from "./zip.ts";

export type Block =
  | { kind: "line"; text: string }
  | { kind: "row"; cells: string[]; first: boolean };

const decode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

// Text of one paragraph. Line breaks inside it (<w:br/>) become "\n".
function paragraphText(xml: string): string {
  let out = "";
  for (const m of xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:br\b[^>]*\/>|<w:cr\/>|<w:tab\/>/g)) {
    if (m[1] !== undefined) out += decode(m[1]);
    else out += m[0].startsWith("<w:tab") ? " " : "\n";
  }
  return out;
}

export function readDocx(path: string): Block[] {
  const xml = readZipEntry(readFileSync(path), "word/document.xml").toString("utf8");
  const blocks: Block[] = [];

  // Walk tables and paragraphs at the top level, in order.
  for (const m of xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g)) {
    if (m[0].startsWith("<w:tbl>")) {
      let first = true;
      for (const row of m[0].matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)) {
        const cells = [...row[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((c) =>
          paragraphText(c[0]).replace(/\s+/g, " ").trim(),
        );
        if (cells.some(Boolean)) { blocks.push({ kind: "row", cells, first }); first = false; }
      }
    } else {
      for (const line of paragraphText(m[0]).split("\n")) {
        const text = line.replace(/\s+/g, " ").trim();
        if (text) blocks.push({ kind: "line", text });
      }
    }
  }
  return blocks;
}
