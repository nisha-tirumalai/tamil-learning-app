// Chat building blocks (spec 001), no database or model needed.
import { describe, expect, test } from "vitest";
import { CHAT_CONFIG, MISTAKE_TYPES, PRAISE_LINES, SITUATIONS } from "@/lib/chat/config";
import { FakeModel, loadPrompt } from "@/lib/chat/model";
import { firstName, pickPraise, pickSituation } from "@/lib/chat/pick";
import { checkScorerOutput, toScore } from "@/lib/chat/scorer";
import { hasTamilScript } from "@/lib/chat/tamil";
import { askScorer, buildThread, sceneText, splitReply, tutorTurns, type MessageRow } from "@/lib/chat/turn";
import { goodAnswer } from "./fixtures";


describe("scorer output check", () => {
  test("accepts a well-formed answer", () => {
    expect(checkScorerOutput(goodAnswer)).toMatchObject({ ok: true });
  });
  test("rejects a wrong total", () => {
    expect(checkScorerOutput({ ...goodAnswer, total: 8 })).toMatchObject({ ok: false });
  });
  test("rejects an out-of-range part", () => {
    expect(checkScorerOutput({ ...goodAnswer, grammar: 7, total: 9 })).toMatchObject({ ok: false });
    expect(checkScorerOutput({ ...goodAnswer, spoken: 5, total: 10 })).toMatchObject({ ok: false });
    expect(checkScorerOutput({ ...goodAnswer, grammar: -1, total: 1 })).toMatchObject({ ok: false });
  });
  test("rejects non-whole numbers", () => {
    expect(checkScorerOutput({ ...goodAnswer, grammar: 4.5, spoken: 2.5, total: 7 })).toMatchObject({ ok: false });
  });
  test("rejects an unknown mistake type (spelling is never a mistake)", () => {
    expect(checkScorerOutput({ ...goodAnswer, mistake_types: ["spelling"] })).toMatchObject({ ok: false });
  });
  test("rejects Tamil script anywhere", () => {
    expect(checkScorerOutput({ ...goodAnswer, better: "இன்னிக்கி naal" })).toMatchObject({ ok: false, problem: "Tamil script" });
  });
  test("all-English messages are never scored", () => {
    const r = checkScorerOutput({ ...goodAnswer, kind: "all_english", grammar: 3, spoken: 2, total: 5, mistake_types: [] });
    expect(r.ok && [r.value.grammar, r.value.spoken, r.value.total]).toEqual([null, null, null]);
  });
  test("a safety answer needs a caring message", () => {
    const safety = { ...goodAnswer, kind: "safety", grammar: null, spoken: null, total: null, better: "", mistake_types: [] };
    expect(checkScorerOutput(safety)).toMatchObject({ ok: false });
    expect(checkScorerOutput({ ...safety, care_message: "I'm really glad you told me." })).toMatchObject({ ok: true });
  });
  test("the mistake list is exactly the spec's", () => {
    expect([...MISTAKE_TYPES]).toEqual(["verb tense", "verb ending", "missing case ending", "word order", "wrong word", "missing word", "too formal", "too literal"]);
  });
});

describe("perfect and all-English cards", () => {
  test("10/10 shows a praise line and no mistake tags", () => {
    const perfect = { ...goodAnswer, grammar: 6, spoken: 4, total: 10, mistake_types: ["too literal"] } as const;
    const score = toScore(perfect as never, PRAISE_LINES[0]);
    expect(score.card.praise).toEqual(PRAISE_LINES[0]);
    expect(score.mistake_types).toEqual([]);
  });
  test("10/10 keeps my sentence exactly as the better way", async () => {
    const perfect = { ...goodAnswer, grammar: 6, spoken: 4, total: 10, mistakes: [], mistake_types: [], better: "Naan kadaikkuporen." };
    const out = await askScorer(new FakeModel([perfect]), "system", " Naan kadaikku poren. ", null);
    expect(out?.better).toBe("Naan kadaikku poren.");
  });
  test("below 10 keeps the scorer's better way", async () => {
    const out = await askScorer(new FakeModel([goodAnswer]), "system", "En naal nalla illa.", null);
    expect(out?.better).toBe(goodAnswer.better);
  });
  test("below 10 shows no praise", () => {
    expect(toScore(goodAnswer as never, PRAISE_LINES[0]).card.praise).toBeNull();
  });
  test("praise is never the same line twice in a row", () => {
    for (let i = 0; i < 200; i++) {
      const last = PRAISE_LINES[i % PRAISE_LINES.length].tanglish;
      expect(pickPraise(last).tanglish).not.toBe(last);
    }
    expect(PRAISE_LINES.length).toBeGreaterThanOrEqual(20);
  });
});

describe("Tamil-script guard", () => {
  test("finds Tamil letters in strings, lists and objects", () => {
    expect(hasTamilScript("vanakkam")).toBe(false);
    expect(hasTamilScript("வணக்கம்")).toBe(true);
    expect(hasTamilScript({ a: ["ok", { b: "நன்றி" }] })).toBe(true);
    expect(hasTamilScript({ a: ["ok", 3, null] })).toBe(false);
  });
  test("nothing in the config or prompts has Tamil script", () => {
    expect(hasTamilScript([PRAISE_LINES, SITUATIONS])).toBe(false);
    expect(hasTamilScript(loadPrompt(CHAT_CONFIG.prompts.corrector, {}))).toBe(false);
    expect(hasTamilScript(loadPrompt(CHAT_CONFIG.prompts.tutor, {}))).toBe(false);
  });
});

describe("Laddu starts", () => {
  test("there are about 10 situations", () => {
    expect(SITUATIONS.length).toBe(10);
    expect(new Set(SITUATIONS.map((s) => s.key)).size).toBe(10);
  });
  test("picks from the list, never the same situation twice in a row", () => {
    let last: string | null = null;
    for (let i = 0; i < 300; i++) {
      const s = pickSituation(last);
      expect(SITUATIONS).toContain(s);
      expect(s.key).not.toBe(last);
      last = s.key;
    }
  });
});

describe("small helpers", () => {
  test("first name from the profile", () => {
    expect(firstName("nisha.tirumalai")).toBe("Nisha");
    expect(firstName("Nisha")).toBe("Nisha");
    expect(firstName(null)).toBe("friend");
  });
  test("splits Laddu's reply into Tanglish and English", () => {
    expect(splitReply("Saapteeya, Nisha?\nHave you eaten, Nisha?")).toEqual({ text: "Saapteeya, Nisha?", english: "Have you eaten, Nisha?" });
    expect(splitReply("\"Enna aachu?\"\n(What happened?)\n")).toEqual({ text: "Enna aachu?", english: "What happened?" });
  });
  test("prompts fill in their placeholders", () => {
    const p = loadPrompt(CHAT_CONFIG.prompts.tutor, { name: "Nisha", scene: "SCENE" });
    expect(p).toContain("Nisha's close friend");
    expect(p).toContain("SCENE");
    expect(p).not.toMatch(/\{\{\w+\}\}/);
  });
  test("try-agains sit under their original message", () => {
    const row = (id: number, role: "me" | "laddu", retry_of: number | null = null): MessageRow =>
      ({ id, role, text: `m${id}`, english: role === "laddu" ? "e" : null, meant: null, retry_of, created_at: "", scores: [] });
    const thread = buildThread([row(1, "laddu"), row(2, "me"), row(3, "me", 2), row(4, "me", 2), row(5, "laddu")]);
    expect(thread.map((t) => t.type)).toEqual(["laddu", "me", "laddu"]);
    expect(thread[1].type === "me" && thread[1].attempts.map((a) => a.id)).toEqual([2, 3, 4]);
  });
});

describe("what Laddu sees (spec 002)", () => {
  const row = (id: number, role: "me" | "laddu", over: Partial<MessageRow> = {}): MessageRow => ({
    id, role, text: `m${id}`, english: role === "laddu" ? "e" : null, meant: null, retry_of: null, created_at: "",
    scores: role === "me" ? [{ grammar: 4, spoken: 2, total: 6, mistake_types: [], card: { understood: "the scorer's guess" } as never }] : [],
    ...over,
  });
  test("he reads my own words, not the scorer's guess", () => {
    const turns = tutorTurns([row(1, "laddu"), row(2, "me", { text: "Na konjam sweets samikiren" })]);
    expect(turns.at(-1)).toEqual({ role: "user", content: "Na konjam sweets samikiren" });
    expect(JSON.stringify(turns)).not.toContain("the scorer's guess");
  });
  test("but if I said what I meant, he gets that", () => {
    const turns = tutorTurns([row(2, "me", { meant: "I'm making sweets" })]);
    expect(turns[0].content).toContain("I'm making sweets");
  });
  test("two of my messages in a row (a failed reply in between) become one turn", () => {
    const turns = tutorTurns([row(1, "laddu"), row(2, "me"), row(3, "me")]);
    expect(turns.map((t) => t.role)).toEqual(["user", "assistant", "user"]);
    expect(turns.at(-1)!.content).toBe("m2\nm3");
  });
  test("in a situation he stays in his role; otherwise he stays a friend", () => {
    expect(sceneText("grocery", "Nisha", false)).toContain("the grocery shop owner");
    expect(sceneText("grocery", "Nisha", false)).toContain("Stay in this role for the whole chat");
    expect(sceneText(null, "Nisha", false)).toContain("Stay her friend");
    expect(sceneText(null, "Nisha", true)).toContain("Open the conversation");
  });
  test("config uses tutor v2, and v1 is kept for comparison", () => {
    expect(CHAT_CONFIG.prompts.tutor).toBe("tutor_system_v2");
    expect(hasTamilScript(loadPrompt("tutor_system_v1", {}))).toBe(false);
    const v2 = loadPrompt("tutor_system_v2", { name: "Nisha", scene: "S" });
    expect(v2).toContain("ends with a question or an invitation");
    expect(v2).toContain("988");
  });
});
