// The chat screen's bubbles and chips (spec 002), drawn as HTML without a
// browser. Checks what shows before any tap (closed) and after (open).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CHIP_TEXT, PRAISE_LINES } from "@/lib/chat/config";
import { chipFor, lowScoreHint } from "@/lib/chat/chip";
import { toScore } from "@/lib/chat/scorer";
import type { Attempt } from "@/lib/chat/turn";
import { LadduBubble, MyTurn } from "@/components/Turns";
import { EnglishCard, LadduSpeech, MySpeech, Stage, TryHint } from "@/components/Scene";
import { LadduIntro } from "@/components/LadduIntro";
import { goodAnswer } from "./fixtures";

const none = new Set<number>();
const attempt = (id: number, over: Record<string, unknown> = {}, praise: (typeof PRAISE_LINES)[number] | null = null): Attempt =>
  ({ id, text: `message ${id}`, meant: null, score: toScore({ ...goodAnswer, ...over } as never, praise) });
const perfect = { grammar: 6, spoken: 4, total: 10, mistake_types: [] };
const allEnglish = { kind: "all_english", grammar: null, spoken: null, total: null, mistake_types: [] };
const safety = { kind: "safety", grammar: null, spoken: null, total: null, mistake_types: [], better: "", care_message: "We care." };
const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("Laddu's bubble", () => {
  test("shows only the Tanglish until tapped", () => {
    const closed = html(<LadduBubble text="Enna vaangalaam?" english="What shall we buy?" />);
    expect(closed).toContain("Enna vaangalaam?");
    expect(closed).not.toContain('class="english"');
    expect(closed).toContain('aria-expanded="false"');
  });
  test("tapped: the English shows underneath", () => {
    expect(html(<LadduBubble text="Enna vaangalaam?" english="What shall we buy?" defaultOpen />))
      .toContain('<p class="english">What shall we buy?</p>');
  });
  test("while he's typing there's nothing to tap", () => {
    expect(html(<LadduBubble text="Enna" english="" typing />)).not.toContain("<button");
  });
});

describe("the chip under my message", () => {
  test("a scored message: ⭐ 7, and the card is closed", () => {
    const out = html(<MyTurn attempts={[attempt(1)]} pending={none} actions={undefined} />);
    expect(out).toContain("⭐ 7");
    expect(out).not.toContain("correction");
    expect(out).not.toContain(goodAnswer.better);
  });
  test("tapped: the card opens with the better way and the buttons", () => {
    const actions = { onRetry: async () => {}, onMeant: async () => {}, onFlag: async () => true };
    const out = html(<MyTurn attempts={[attempt(1)]} pending={none} actions={actions} defaultOpen />);
    expect(out).toContain(goodAnswer.better);
    expect(out).toContain("I understood");
    expect(out).toContain("Try again");
    expect(out).toContain("Looks wrong?");
    expect(out).not.toContain("Continue");
  });
  test("10/10 shows the praise line in the chip", () => {
    expect(chipFor([attempt(1, perfect, PRAISE_LINES[0])], none)).toEqual({ kind: "open", label: PRAISE_LINES[0].tanglish });
  });
  test("all English: \"Try it in Tanglish\"", () => {
    expect(chipFor([attempt(1, allEnglish)], none)).toEqual({ kind: "open", label: CHIP_TEXT.allEnglish });
  });
  test("a safety message: no chip and no card, even if asked to open", () => {
    expect(chipFor([attempt(1, safety)], none)).toEqual({ kind: "none" });
    const out = html(<MyTurn attempts={[attempt(1, safety)]} pending={none} defaultOpen />);
    expect(out).not.toContain("chip");
    expect(out).not.toContain("correction");
  });
  test("score on its way: ⭐ …", () => {
    expect(chipFor([attempt(1)], new Set([1]))).toEqual({ kind: "pending", label: "⭐ …" });
  });
  test("score failed: tap to retry (past chats just show nothing)", () => {
    const failed: Attempt = { id: 1, text: "x", meant: null, score: null };
    expect(chipFor([failed], none)).toEqual({ kind: "failed", label: CHIP_TEXT.failed });
    expect(chipFor([failed], none, true)).toEqual({ kind: "none" });
  });
  test("after a try again: both scores", () => {
    expect(chipFor([attempt(1), attempt(2, { grammar: 6, spoken: 3, total: 9 })], none).label).toBe("⭐ 7 → 9");
    expect(chipFor([attempt(1), attempt(2)], new Set([2])).label).toBe("⭐ 7 → …");
  });
});

describe("the conversation scene (spec 003)", () => {
  test("Laddu's bubble: Tanglish only until tapped; a line that isn't saved has nothing to tap", () => {
    const line = html(<LadduSpeech line={{ kind: "line", text: "Evlo venum?", english: "How much do you need?" }} />);
    expect(line).toContain("Evlo venum?");
    expect(line).not.toContain("How much");
    expect(line).toContain('aria-expanded="false"');
    expect(html(<LadduSpeech line={{ kind: "say", text: "Aiyo" }} />)).not.toContain("<button");
  });
  test("ⓘ on Laddu's bubble opens a small card with the English (from the saved reply)", () => {
    const line = html(<LadduSpeech line={{ kind: "line", text: "Evlo venum?", english: "How much do you need?" }} onInfo={() => {}} />);
    expect(line).toContain('class="info-button"');
    expect(line).toContain("What does that mean in English?");
    expect(line).not.toContain("How much");
    expect(html(<LadduSpeech line={{ kind: "typing", text: "Evlo" }} onInfo={() => {}} />)).not.toContain("info-button");
    const card = html(<EnglishCard english="How much do you need?" onClose={() => {}} />);
    expect(card).toContain("In English");
    expect(card).toContain("<p>How much do you need?</p>");
  });
  test("my bubble: the ⭐ chip on its corner; spoken lines can be fixed, typed ones can't", () => {
    const spoken = html(<MySpeech attempts={[{ ...attempt(1), spoken: true }]} pending={none} listening={false} onChip={() => {}} onRescore={() => {}} onFix={() => {}} />);
    expect(spoken).toContain("chip corner");
    expect(spoken).toContain("⭐ 7");
    expect(spoken).toContain("tap to fix what Laddu heard");
    const typed = html(<MySpeech attempts={[attempt(1)]} pending={none} listening={false} onChip={() => {}} onRescore={() => {}} />);
    expect(typed).not.toContain("tap to fix");
  });
  test("while I'm talking, my bubble shows that Laddu is listening", () => {
    expect(html(<MySpeech attempts={null} pending={none} listening onChip={() => {}} onRescore={() => {}} />)).toContain('aria-label="Listening"');
  });
  test("the scene: cartoon background, both of us side by side facing each other; Laddu's mouth can open", () => {
    const out = html(<Stage ladduMouth="wide" ladduEyes="open" myMouth="closed" myEyes="blink" ladduBubble={null} myBubble={null} />);
    expect(out).toContain('class="backdrop"');
    expect(out).toContain("#ffd84d");   // the sun
    expect(out.indexOf("Laddu the teddy bear")).toBeLessThan(out.indexOf('aria-label="You"'));   // Laddu on the left
    expect(out).toContain("#7a2c22");   // an open mouth
  });
});

describe("💡 hint when my score is below 7 (spec 003)", () => {
  const low = { grammar: 4, spoken: 2, total: 6 };
  test("below 7: the better way the scorer already wrote", () => {
    expect(lowScoreHint([attempt(1, low)], none)).toEqual({ id: 1, better: goodAnswer.better, english: goodAnswer.better_english });
  });
  test("7 or more: no hint", () => {
    expect(lowScoreHint([attempt(1)], none)).toBeNull();   // 7
    expect(lowScoreHint([attempt(1, perfect, PRAISE_LINES[0])], none)).toBeNull();
  });
  test("no hint while the score is coming, for all English or safety, or with no score", () => {
    expect(lowScoreHint([attempt(1, low)], new Set([1]))).toBeNull();
    expect(lowScoreHint([attempt(1, allEnglish)], none)).toBeNull();
    expect(lowScoreHint([attempt(1, safety)], none)).toBeNull();
    expect(lowScoreHint([{ id: 1, text: "x", meant: null, score: null }], none)).toBeNull();
    expect(lowScoreHint(null, none)).toBeNull();
  });
  test("it follows my latest try: a better retry makes it go away", () => {
    expect(lowScoreHint([attempt(1, low), attempt(2)], none)).toBeNull();
    expect(lowScoreHint([attempt(1), attempt(2, low)], none)?.id).toBe(2);
  });
  test("the card: Tanglish with 💡 Try:, English only behind ⓘ", () => {
    const out = html(<TryHint better="Inniki naal sariyaa pogala." english="Today didn't go well." onClose={() => {}} />);
    expect(out).toContain("💡");
    expect(out).toContain("Try: <strong>Inniki naal sariyaa pogala.</strong>");
    expect(out).toContain('class="info-button"');
    expect(out).not.toContain("Today didn");
  });
  test("it sits in the scene and doesn't replace either bubble", () => {
    const out = html(<Stage ladduMouth="closed" ladduEyes="open" myMouth="closed" myEyes="open"
      ladduBubble={<span>L</span>} myBubble={<span>M</span>} hint={<span>H</span>} />);
    expect(out).toContain('<div class="hint-wrap"><span>H</span></div>');
    expect(out).toContain("<span>L</span>");
    expect(out).toContain("<span>M</span>");
  });
});

describe("welcome: Laddu introduces himself (spec 003)", () => {
  test("his line in Tanglish, English only behind ⓘ, a button to hear him, then choose your avatar", () => {
    const out = html(<LadduIntro />);
    expect(out).toContain("Vanakkam! Naan Laddu. Tamil-la pesalaam!");
    expect(out).toContain("What does that mean in English?");
    expect(out).not.toContain("Let&#x27;s talk in Tamil");
    expect(out).toContain("🔊 Hear Laddu");
    expect(out).toContain('href="/choose-avatar"');
    expect(out).not.toMatch(/[\u0B80-\u0BFF]/);   // no Tamil script on screen
  });
});
