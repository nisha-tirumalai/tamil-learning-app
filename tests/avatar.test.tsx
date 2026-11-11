// Choose your avatar (spec 003): the picker and the chat bubble draw the right
// character. Rendered as HTML without a browser, like screen.test.tsx.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

// The picker's form points at a server action; tests don't need a real server.
vi.mock("@/app/settings/actions", () => ({ chooseAvatar: async () => {} }));

import { AvatarProvider } from "@/components/AvatarContext";
import { AvatarPicker } from "@/components/AvatarPicker";
import { Me } from "@/components/Characters";
import { afterChoosing, isAvatar } from "@/lib/avatar";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("choose your avatar", () => {
  test("first time: two choices, girl and guy, none chosen", () => {
    const out = html(<AvatarPicker current={null} next="/" />);
    expect(out).toContain('value="girl"');
    expect(out).toContain('value="guy"');
    expect(out).not.toContain('aria-pressed="true"');
  });
  test("in settings: the current one is marked", () => {
    const out = html(<AvatarPicker current="guy" next="/settings" />);
    expect(out).toMatch(/aria-pressed="true"[^>]*value="guy"|value="guy"[^>]*aria-pressed="true"/);
  });
  test("only girl or guy count as a choice", () => {
    expect(isAvatar("girl")).toBe(true);
    expect(isAvatar("guy")).toBe(true);
    expect(isAvatar("cat")).toBe(false);
    expect(isAvatar(null)).toBe(false);
  });
  test("afterwards it only ever goes home or back to settings", () => {
    expect(afterChoosing("/settings")).toBe("/settings");
    expect(afterChoosing("https://evil.example")).toBe("/");
    expect(afterChoosing(null)).toBe("/");
  });
});

describe("my bubble uses my avatar", () => {
  test("guy", () => {
    const out = html(<AvatarProvider avatar="guy"><Me /></AvatarProvider>);
    expect(out).toContain("#f2c230");   // the guy's yellow shirt
  });
  test("girl", () => {
    const out = html(<AvatarProvider avatar="girl"><Me /></AvatarProvider>);
    expect(out).not.toContain("#f2c230");
    expect(out).toContain('aria-label="You"');
  });
});
