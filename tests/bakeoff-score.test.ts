// The bake-off's free, no-AI score (spec 003, step 1): Tanglish spelling and
// Tamil script must not count as hearing mistakes; real changes must.
import { describe, expect, test } from "vitest";
import { skeleton, soundAlikeErrorRate, transliterate } from "../evaluation/bakeoff/score.ts";

describe("sound-alike score", () => {
  test("Tamil script is turned into Latin letters", () => {
    expect(transliterate("வீட்டுக்கு")).toBe("viiddukku");
    expect(transliterate("நான்")).toBe("naan");
  });
  test("spelling variants are the same", () => {
    expect(skeleton("veetukku")).toBe(skeleton("veettukku"));
    expect(skeleton("irundhuchu")).toBe(skeleton("irunthuchu"));
    expect(soundAlikeErrorRate("Naan veetukku poren", "நான் வீட்டுக்கு போறேன்")).toBe(0);
  });
  test("word splits don't count", () => {
    expect(soundAlikeErrorRate("office-ku poren", "office ku poren")).toBe(0);
  });
  test("a different word does count", () => {
    expect(soundAlikeErrorRate("Naan veetukku poren", "Naan veetukku ponen")).toBeGreaterThan(0);
    expect(soundAlikeErrorRate("Naan veetukku poren", "")).toBe(1);
  });
});
