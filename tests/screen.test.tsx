// The chat screen's bubbles and chips (spec 002), drawn as HTML without a
// browser. Checks what shows before any tap (closed) and after (open).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CHIP_TEXT, PRAISE_LINES } from "@/lib/chat/config";
import { chipFor } from "@/lib/chat/chip";
import { toScore } from "@/lib/chat/scorer";
import type { Attempt } from "@/lib/chat/turn";
import { LadduBubble, MyTurn } from "@/components/Turns";
import { LadduSpeech, MySpeech, Stage } from "@/components/Scene";
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
  test("ⓘ on Laddu's bubble: there to tap, and the English card is closed until then", () => {
    const line = html(<LadduSpeech line={{ kind: "line", text: "Evlo venum?", english: "How much do you need?" }} />);
    expect(line).toContain('class="info-button"');
    expect(line).toContain("What does that mean in English?");
    expect(line).not.toContain("english-card");
    expect(html(<LadduSpeech line={{ kind: "typing", text: "Evlo" }} />)).not.toContain("info-button");
    const tapped = html(<LadduSpeech line={{ kind: "line", text: "Evlo venum?", english: "How much do you need?" }} defaultInfo />);
    expect(tapped).toContain("english-card");
    expect(tapped).toContain("<p>How much do you need?</p>");
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
  test("both of us stand side by side, full body, facing each other; Laddu's mouth can open", () => {
    const out = html(<Stage ladduMouth="wide" ladduEyes="open" myMouth="closed" myEyes="blink" ladduBubble={null} myBubble={null} />);
    expect(out.indexOf("Laddu the teddy bear")).toBeLessThan(out.indexOf('aria-label="You"'));   // Laddu on the left
    expect(out).toContain("#7a2c22");   // an open mouth
  });
});
