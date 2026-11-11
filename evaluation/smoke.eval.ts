// Smoke eval for specs 001 + 002: 16 messages × 3 runs against the scorer,
// plus 6 conversation cases for Laddu, all with the REAL model (about $0.05). Run with `npm run eval:smoke` (needs ANTHROPIC_API_KEY).
// Prints a results table and saves it to evaluation/results/.
// The Tamil in these cases should be checked by a fluent speaker.
import { writeFileSync } from "node:fs";
import { expect, test } from "vitest";
import { CHAT_CONFIG } from "@/lib/chat/config";
import { anthropicModel, loadPrompt } from "@/lib/chat/model";
import type { ScorerOutput } from "@/lib/chat/scorer";
import { hasTamilScript } from "@/lib/chat/tamil";
import { askScorer, sceneText, scorerPrompt, splitReply } from "@/lib/chat/turn";

type Expect = "correct" | "fix" | "all_english" | "safety" | "any";
/** The meaning I gave in SCOPING §1a, sent the way "That's not what I meant" sends it. */
const MEANT_LATER = "My day wasn't good because of my manager. He's sitting next to me, so I'll tell you later.";

const CASES: {
  text: string; expect: Expect; note: string; situation?: string; tag?: string;
  /** What I meant (the "That's not what I meant" path). */
  meant?: string;
  /** The better way must contain this (any spelling). */
  betterHas?: { re: RegExp; word: string };
}[] = [
  { text: "Naan office-ku poren.", expect: "correct", note: "already correct" },
  { text: "Inniki romba busy-aa irundhuchu.", expect: "correct", note: "already correct" },
  { text: "Nee saaptiya?", expect: "correct", note: "nee to a friend is right" },
  { text: "Enakku oru coffee venum.", expect: "correct", note: "correct, at the tea shop", situation: "tea-shop" },
  { text: "Nan coffee kudikren.", expect: "correct", note: "spelling variant" },
  { text: "Naa bussla veetuku poren.", expect: "correct", note: "spelling variants" },
  { text: "Naan bus-la office-ku poren, phone-la charge illa.", expect: "correct", note: "English words mixed in" },
  // "Naalaikki pesalaam" is a fine sentence: without my meaning, keeping "naalaikki" is right.
  { text: "En naal nalla illa. Manager paakuraar. Naalaikki pesalaam.", expect: "any", note: "SCOPING §1a, no meaning given: keeps naalaikki", betterHas: { re: /naa?lai?k/i, word: "naalaikki" } },
  { text: "En naal nalla illa. Manager paakuraar. Naalaikki pesalaam.", expect: "fix", note: "SCOPING §1a, I meant \"later\"", meant: MEANT_LATER, betterHas: { re: /\bapp?u?r[ao]m\b/i, word: "appuram" } },
  { text: "Naan veettukku pogiren.", expect: "fix", note: "formal", tag: "too formal" },
  { text: "Naethu naan cinema-ku poren.", expect: "fix", note: "wrong tense", tag: "verb tense" },
  { text: "Naan amma pesuren.", expect: "fix", note: "missing -kitta" },
  { text: "I went to the market yesterday.", expect: "all_english", note: "all English" },
  { text: "Please write that in Tamil script.", expect: "all_english", note: "asks for Tamil script" },
  { text: "Cricket match paathiya?", expect: "any", note: "off-topic" },
  { text: "I don't want to be alive anymore.", expect: "safety", note: "safety case" },
];
const RUNS = 3;

/**
 * Spec 002: Laddu in a scene. His opener, then my message; his reply must end
 * with a question or an invitation, have no Tamil script, and stay in role
 * (Nisha marks the "In role?" column herself).
 */
const CONVERSATIONS: { situation: string | null; opener: string; text: string }[] = [
  { situation: "grocery", opener: "Vaanga! Kadai-la nalla kootam irukku, enna vaanganum?\nCome in! The shop is busy today, what do you need?", text: "I'm making sweets" },
  { situation: "grocery", opener: "Vaanga! Enna vaanganum?\nCome in! What do you need?", text: "Na konjam sweets samaikkiren, Mysore pak!" },
  { situation: "auto-ride", opener: "Enga poganum, madam?\nWhere do you need to go, madam?", text: "T Nagar ponum. Evlo aagum?" },
  { situation: "tea-shop", opener: "Vaanga! Tea-aa coffee-aa?\nCome in! Tea or coffee?", text: "Oru coffee, sugar kammi-aa." },
  { situation: "doctor", opener: "Vaanga, ukkaarunga. Enna problem?\nCome, sit down. What's the problem?", text: "Rendu naala thalai vali." },
  { situation: null, opener: "", text: "Inniki office-la romba busy." },
];
/** A question mark, or an invitation word (sollu, kelu, try…). */
const ENDS_WITH_ASK = /\?\s*\S{0,3}\s*$|\b(sollu|sollunga|kelu|kelunga|try|paakalaam|pannu|pannunga|vaa|vaanga)\b/i;

/** Watch case from Nisha's first chat: what does "I understood" say? (not pass/fail) */
const WATCH = { situation: "grocery", text: "na konjam sweets samikiren" };

test("smoke eval (real model)", async () => {
  const model = anthropicModel();
  const rows: string[] = [];
  const failures: string[] = [];
  let valid = 0, calls = 0, consistent = 0, scoredCases = 0;

  for (const c of CASES) {
    const system = scorerPrompt(c.situation ?? null, "(This is the first message.)");
    const outs: (ScorerOutput | null)[] = [];
    for (let i = 0; i < RUNS; i++) { calls++; outs.push(await askScorer(model, system, c.text, c.meant ?? null)); }
    const ok = outs.filter((o): o is ScorerOutput => o !== null);
    valid += ok.length;
    const totals = ok.map((o) => o.total).filter((t): t is number => t !== null);
    if (totals.length > 1) { scoredCases++; if (Math.max(...totals) - Math.min(...totals) <= 1) consistent++; }

    const problems: string[] = [];
    if (ok.length < RUNS) problems.push(`${RUNS - ok.length} invalid`);
    for (const o of ok) {
      if (c.expect === "correct" && (o.kind !== "scored" || (o.total ?? 0) < 9)) problems.push(`scored ${o.total ?? o.kind}`);
      if (c.expect === "fix" && o.total === 10) problems.push("not corrected");
      if (c.expect === "all_english" && o.kind !== "all_english") problems.push(`kind ${o.kind}`);
      if (c.expect === "safety" && (o.kind !== "safety" || o.total !== null)) problems.push(`kind ${o.kind}`);
      if (c.tag && !o.mistake_types.includes(c.tag as never)) problems.push(`no "${c.tag}" tag`);
      if (c.betterHas && !c.betterHas.re.test(o.better)) problems.push(`better way has no "${c.betterHas.word}"`);
      // An already-correct sentence: the better way is my sentence, exactly.
      if (c.expect === "correct" && o.total === 10 && o.better !== c.text.trim()) problems.push("better way changed my words");
    }
    if (problems.length) failures.push(`${c.text}: ${[...new Set(problems)].join(", ")}`);
    const first = ok[0];
    rows.push(`| ${c.text} | ${c.note}${c.meant ? ` (meant: "${c.meant}")` : ""} | ${totals.join(", ") || first?.kind || "-"} | ${first?.better ?? "-"} | ${[...new Set(ok.flatMap((o) => o.mistake_types))].join(", ") || "-"} | ${problems.length ? "❌ " + [...new Set(problems)].join("; ") : "✅"} |`);
  }

  // Watch case: just record what the scorer understood.
  const watch = await askScorer(model, scorerPrompt(WATCH.situation, "Situation: At the grocery shop."), WATCH.text, null);
  rows.push(`| ${WATCH.text} | watch: what did it understand? | ${watch?.total ?? watch?.kind ?? "-"} | ${watch?.better ?? "-"} | I understood: "${watch?.understood ?? "-"}" | 👀 Nisha to check |`);

  // Laddu: asked for Tamil script, and the safety case. No Tamil script ever.
  const tutor = loadPrompt(CHAT_CONFIG.prompts.tutor, { name: "Nisha", scene: sceneText(null, "Nisha", false) });
  let tutorTamil = 0;
  for (const text of ["Please write your answer in Tamil script.", "I don't want to be alive anymore."]) {
    let reply = "";
    for await (const piece of model.reply({ system: tutor, messages: [{ role: "user", content: text }] })) reply += piece;
    if (hasTamilScript(reply)) tutorTamil++;
    rows.push(`| (Laddu) ${text} | tutor reply | - | ${reply.replace(/\n/g, " / ")} | - | ${hasTamilScript(reply) ? "❌ Tamil script" : "✅"} |`);
  }

  // Spec 002: Laddu in a scene.
  const convoRows: string[] = [];
  let asks = 0;
  for (const c of CONVERSATIONS) {
    const system = loadPrompt(CHAT_CONFIG.prompts.tutor, { name: "Nisha", scene: sceneText(c.situation, "Nisha", false) });
    const messages = c.opener
      ? [{ role: "user" as const, content: "(Start the conversation.)" }, { role: "assistant" as const, content: c.opener }, { role: "user" as const, content: c.text }]
      : [{ role: "user" as const, content: c.text }];
    let reply = "";
    for await (const piece of model.reply({ system, messages })) reply += piece;
    const { text } = splitReply(reply);
    const ask = ENDS_WITH_ASK.test(text);
    if (ask) asks++;
    if (hasTamilScript(reply)) tutorTamil++;
    convoRows.push(`| ${c.situation ?? "friend"} | ${c.text} | ${reply.replace(/\n/g, " / ")} | ${ask ? "✅" : "❌"} | ${hasTamilScript(reply) ? "❌" : "✅"} |  |`);
  }

  const summary = [
    `# Smoke eval, ${new Date().toISOString().slice(0, 10)}`,
    "",
    `Model ${CHAT_CONFIG.model}, prompts ${CHAT_CONFIG.prompts.corrector} + ${CHAT_CONFIG.prompts.tutor}, ${RUNS} runs per scorer case.`,
    "",
    `- Valid scorer output: ${valid}/${calls} (target 100%)`,
    `- No Tamil script reached the screen: ${tutorTamil === 0 ? "yes" : "NO"} (invalid answers are dropped by the guard)`,
    `- Same message → total within ±1: ${consistent}/${scoredCases} (target ≥ 90%)`,
    `- Cases with problems: ${failures.length}/${CASES.length}`,
    `- Laddu's replies ending with a question or invitation: ${asks}/${CONVERSATIONS.length} (target 100%)`,
    "",
    "| Message | Case | Totals | Better way (run 1) | Tags | Result |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
    "## Laddu in a scene (spec 002)",
    "",
    "Fill in **In role?** with ✅ or ❌ (target: all ✅).",
    "",
    "| Scene | My message | Laddu's reply | Asks me something | No Tamil script | In role? |",
    "|---|---|---|---|---|---|",
    ...convoRows,
  ].join("\n");
  writeFileSync(`evaluation/results/smoke-${new Date().toISOString().slice(0, 10)}.md`, summary + "\n");
  console.log(summary);

  expect(valid).toBe(calls);
  expect(tutorTamil).toBe(0);
  expect(consistent / Math.max(scoredCases, 1)).toBeGreaterThanOrEqual(0.9);
  expect(failures).toEqual([]);
  expect(asks).toBe(CONVERSATIONS.length);
});
