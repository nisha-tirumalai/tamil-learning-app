// Shared lesson content, read from data/lessons.json (made by `npm run ingest`).
//
// Rule: Tamil script is never shown in the UI. toCard() keeps only what a card
// displays, so the Tamil never even reaches the browser. (Text-to-speech will
// read it on the server in milestone 6.)
import data from "../../data/lessons.json";

export type Register = "colloquial" | "formal" | "neutral";

interface Item {
  id: string;
  lesson: number;
  source?: "book";
  type: string;
  section: string;
  english: string;
  tanglish: string;
  tamil: string;
  register: Register;
  needs_review: boolean;
  tags: string[];
  speaker?: string;
  meaning?: string;
}

/** What a card shows. No Tamil script. */
export interface Card {
  id: string;
  english: string;
  tanglish: string;
  register: Register;
  type: string;
  speaker?: string;
}

const items = data.items as unknown as Item[];

export function toCard(item: Item): Card {
  const { id, english, tanglish, register, type, speaker } = item;
  return { id, english, tanglish, register, type, ...(speaker ? { speaker } : {}) };
}

export interface LessonSummary { key: string; title: string; count: number }

/** Lessons for the home page: teacher's lessons as "1".."12", book lessons as "book-1". */
export function lessonList(): LessonSummary[] {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(lessonKey(i), (counts.get(lessonKey(i)) ?? 0) + 1);
  return [...counts].map(([key, count]) => ({ key, title: lessonTitle(key), count }));
}

/** A lesson's cards, grouped by section in their original order. */
export function lessonSections(key: string): { section: string; cards: Card[] }[] | undefined {
  const lessonItems = items.filter((i) => lessonKey(i) === key);
  if (!lessonItems.length) return undefined;
  const sections = new Map<string, Card[]>();
  for (const i of lessonItems) {
    if (!sections.has(i.section)) sections.set(i.section, []);
    sections.get(i.section)!.push(toCard(i));
  }
  return [...sections].map(([section, cards]) => ({ section, cards }));
}

/** Looks up an item by id, for saving a flag with a trustworthy snapshot. */
export function findCard(id: string): Card | undefined {
  const item = items.find((i) => i.id === id);
  return item && toCard(item);
}

function lessonKey(i: Item) { return i.source === "book" ? `book-${i.lesson}` : String(i.lesson); }
export function lessonTitle(key: string) {
  return key.startsWith("book-") ? `Adi's Book, Lesson ${key.slice(5)}` : `Lesson ${key}`;
}
