// Checks on the lesson data and what the app shows from it. No database needed.
import { describe, expect, test } from "vitest";
import data from "../data/lessons.json";
import { findCard, lessonList, lessonSections } from "../src/lib/lessons";

type Item = { id: string; english: string; tanglish: string; tamil: string; tags: string[]; source?: string };
const items = data.items as unknown as Item[];
const TAMIL_SCRIPT = /[஀-௿]/;

describe("lesson data", () => {
  test("every item has its own id", () => {
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  test("every item has English and Tanglish", () => {
    const missing = items.filter((i) => !i.english.trim() || !i.tanglish.trim()).map((i) => i.id);
    expect(missing).toEqual([]);
  });

  test("no Tamil script in the text the app displays", () => {
    const leaks = items.filter((i) => TAMIL_SCRIPT.test(i.english) || TAMIL_SCRIPT.test(i.tanglish)).map((i) => i.id);
    expect(leaks).toEqual([]);
  });

  test("the stored Tamil (for text-to-speech) really is Tamil script", () => {
    const wrong = items.filter((i) => i.tamil && !TAMIL_SCRIPT.test(i.tamil)).map((i) => i.id);
    expect(wrong).toEqual([]);
  });

  test("namaskāram and nandri are there as greetings, with Tamil for the voice", () => {
    const greetings = items.filter((i) => i.tags.includes("greeting"));
    expect(greetings.map((g) => g.tanglish)).toEqual(expect.arrayContaining(["namaskāram", "nandri"]));
    for (const g of greetings) expect(g.tamil).toMatch(TAMIL_SCRIPT);
  });
});

describe("what the app sends to the browser", () => {
  test("cards never include the Tamil script", () => {
    for (const { key } of lessonList()) {
      for (const { cards } of lessonSections(key)!) {
        for (const card of cards) {
          expect(card).not.toHaveProperty("tamil");
          expect(JSON.stringify(card)).not.toMatch(TAMIL_SCRIPT);
        }
      }
    }
  });

  test("every lesson is listed, including Adi's Book", () => {
    const keys = lessonList().map((l) => l.key);
    expect(keys).toEqual(expect.arrayContaining(["1", "12", "book-1"]));
    expect(keys).not.toContain("6");      // there is no Lesson 6
  });

  test("a flag's snapshot comes from the real item", () => {
    const item = items[0];
    expect(findCard(item.id)).toMatchObject({ english: item.english, tanglish: item.tanglish });
    expect(findCard("not-a-real-id")).toBeUndefined();
  });
});
