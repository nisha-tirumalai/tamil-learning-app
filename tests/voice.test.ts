// Spec 003 (voice), without a database: recordings, hearing → Tanglish, the
// fallback, Laddu's voice player (mute, replay, slow) and the call log.
// Fake services only: no keys, no cost.
import { describe, expect, test } from "vitest";
import { memoryLog } from "@/lib/calls";
import { claudeCost, FakeModel } from "@/lib/chat/model";
import { hasTamilScript } from "@/lib/chat/tamil";
import { HEARING_ERROR_TEXT, TOO_LONG_TEXT, TOO_SHORT_TEXT, VOICE_CONFIG } from "@/lib/voice/config";
import { checkRecording, toTanglish } from "@/lib/voice/heard";
import { type AudioLike, mouthFor, VoicePlayer } from "@/lib/voice/player";
import { forgetIntroVoice, INTRO_TAMIL, introVoice } from "@/lib/voice/intro";
import { INTRO } from "@/lib/chat/config";
import { configuredHearing, configuredVoice, FakeHearing, FakeVoice, hear, speak } from "@/lib/voice/services";

const rec = (ms = 3000) => ({ audio: new Blob([new Uint8Array(20_000)], { type: "audio/webm" }), ms });

describe("the config", () => {
  test("bake-off decisions: ElevenLabs hears (Azure as fallback), Charlie speaks", () => {
    expect(VOICE_CONFIG.hearing).toBe("elevenlabs");
    expect(VOICE_CONFIG.hearingFallback).toBe("azure");
    expect(VOICE_CONFIG.voice).toBe("elevenlabs");
    expect(VOICE_CONFIG.elevenlabs.voiceName).toBe("Charlie");
    expect(VOICE_CONFIG.elevenlabs.voiceModel).toBe("eleven_multilingual_v2");
    expect(configuredHearing().map((h) => h.id)).toEqual(["elevenlabs", "azure"]);
    expect(configuredVoice().model).toBe("Charlie · eleven_multilingual_v2");
  });
  test("Laddu's messages have no Tamil script", () => {
    expect(hasTamilScript([HEARING_ERROR_TEXT, TOO_LONG_TEXT, TOO_SHORT_TEXT])).toBe(false);
  });
});

describe("checking a recording before any paid call", () => {
  const good = { bytes: 20_000, ms: 3000, peak: 0.2 };
  test("a normal recording is fine", () => expect(checkRecording(good)).toBeNull());
  test("too short (a tap)", () => expect(checkRecording({ ...good, ms: 200 })).toBe("too_short"));
  test("too small to hold speech", () => expect(checkRecording({ ...good, bytes: 100 })).toBe("too_short"));
  test("over 30 seconds", () => expect(checkRecording({ ...good, ms: 45_000 })).toBe("too_long"));
  test("silent", () => expect(checkRecording({ ...good, peak: 0.001 })).toBe("silent"));
  test("no loudness sent = treated as silent", () => expect(checkRecording({ ...good, peak: NaN })).toBe("silent"));
  test("nothing at all", () => expect(checkRecording({ bytes: 0, ms: 0, peak: 0 })).toBe("missing"));
});

describe("what Laddu heard → Tanglish", () => {
  test("Tamil script is rewritten as Tanglish (by the model)", async () => {
    const model = new FakeModel();
    model.tanglishAnswers = ["Naan konjam sweets samaikkiren"];
    expect(await toTanglish(model, "நான் கொஞ்சம் ஸ்வீட்ஸ் சமைக்கிறேன்")).toBe("Naan konjam sweets samaikkiren");
    expect(model.tanglishCalls[0].system).toContain("Never fix anything");
  });
  test("already in English letters: no model call", async () => {
    const model = new FakeModel();
    expect(await toTanglish(model, "bus-la office-ku poren")).toBe("Bus-la office-ku poren");
    expect(model.tanglishCalls).toHaveLength(0);
  });
  test("if the model answers in Tamil script, plain letters are used instead: never Tamil on screen", async () => {
    const model = new FakeModel();
    model.tanglishAnswers = ["நான் போறேன்"];
    const out = await toTanglish(model, "நான் போறேன்");
    expect(hasTamilScript(out)).toBe(false);
    expect(out).toBe("Naan poren");
  });
  test("if the model fails, plain letters too", async () => {
    const model = new FakeModel();
    model.tanglishAnswers = [new Error("timeout")];
    expect(await toTanglish(model, "நான் போறேன் bus-la")).toBe("Naan poren bus-la");
  });
  test("nothing heard → empty", async () => {
    expect(await toTanglish(new FakeModel(), "  ")).toBe("");
  });
});

describe("hearing, with the fallback, and the call log", () => {
  test("the main service works: one log row, with seconds and cost, no text", async () => {
    const log = memoryLog();
    const out = await hear([new FakeHearing(["வணக்கம்"]), new FakeHearing([], "azure")], rec(6000), log);
    expect(out).toEqual({ text: "வணக்கம்", service: "elevenlabs" });
    expect(log.entries).toHaveLength(1);
    expect(log.entries[0]).toMatchObject({ service: "elevenlabs", job: "hearing", audio_seconds: 6, ok: true });
    expect(log.entries[0].cost_usd).toBeGreaterThan(0);
    expect(JSON.stringify(log.entries)).not.toContain("வணக்கம்");
  });
  test("the main one fails (e.g. out of credits): Azure is tried, both are logged", async () => {
    const log = memoryLog();
    const quota = Object.assign(new Error("ElevenLabs hearing: quota_exceeded"), { status: 401 });
    const out = await hear([new FakeHearing([quota]), new FakeHearing(["vanakkam"], "azure")], rec(), log);
    expect(out.service).toBe("azure");
    expect(log.entries.map((e) => [e.service, e.ok])).toEqual([["elevenlabs", false], ["azure", true]]);
    expect(log.entries[0].error).toContain("401");
  });
  test("both fail: it throws (the screen shows the friendly message)", async () => {
    await expect(hear([new FakeHearing([new Error("down")]), new FakeHearing([new Error("down")], "azure")], rec())).rejects.toThrow();
  });
});

describe("Laddu's voice, and the call log", () => {
  test("one row per line: characters and cost, no text", async () => {
    const log = memoryLog();
    const voice = new FakeVoice();
    await speak(voice, "என்ன ஆச்சு?", log);
    expect(voice.calls).toEqual(["என்ன ஆச்சு?"]);
    expect(log.entries[0]).toMatchObject({ service: "elevenlabs", job: "voice", characters: 11, ok: true });
    expect(JSON.stringify(log.entries)).not.toContain("ஆச்சு");
  });
  test("a failure is logged and thrown (the reply still shows as text)", async () => {
    const log = memoryLog();
    await expect(speak(new FakeVoice(true), "x", log)).rejects.toThrow();
    expect(log.entries[0]).toMatchObject({ ok: false, error: "FakeVoice: broken" });
  });
  test("Claude cost estimate uses the config's prices", () => {
    expect(claudeCost(1_000_000, 1_000_000)).toBeCloseTo(0.6);
  });
});

class FakeAudio implements AudioLike {
  src = ""; playbackRate = 1; preservesPitch = false;
  onended: (() => void) | null = null; onerror: (() => void) | null = null;
  plays: { src: string; rate: number }[] = [];
  async play() { this.plays.push({ src: this.src, rate: this.playbackRate }); }
  pause() {}
}

function fakePlayer(saved: string | null = null) {
  const fetched: string[] = [];
  const audio = new FakeAudio();
  const store = new Map<string, string>(saved === null ? [] : [["laddu-muted", saved]]);
  const player = new VoicePlayer({
    async fetchAudio(id) { fetched.push(id); return new Blob(["mp3"]); },
    createAudio: () => audio,
    toUrl: () => `blob:${fetched.length}`,
    storage: { get: (k) => store.get(k) ?? null, set: (k, v) => void store.set(k, v) },
  });
  return { player, fetched, audio, store };
}

describe("the voice player on the phone", () => {
  test("no sound until a tap has unlocked it", async () => {
    const { player, fetched } = fakePlayer();
    expect(await player.play(7)).toBe(false);
    expect(fetched).toEqual([]);
    player.unlock();
    expect(await player.play(7)).toBe(true);
    expect(fetched).toEqual(["7"]);
  });
  test("🔁 Again and 🐢 Slow replay the same audio: fetched once, slow is slower", async () => {
    const { player, fetched, audio } = fakePlayer();
    player.unlock();
    await player.play(7);
    await player.play(7);
    await player.play(7, VOICE_CONFIG.slowRate);
    expect(fetched).toEqual(["7"]);
    expect(audio.plays.filter((p) => p.src.startsWith("blob:")).map((p) => p.rate)).toEqual([1, 1, 0.75]);
    expect(audio.preservesPitch).toBe(true);
  });
  test("🔇 Mute: no voice call is made, and it's remembered", async () => {
    const { player, fetched, store } = fakePlayer();
    player.unlock();
    player.setMuted(true);
    expect(await player.play(7)).toBe(false);
    expect(fetched).toEqual([]);
    expect(store.get("laddu-muted")).toBe("1");
    expect(fakePlayer("1").player.muted).toBe(true);
  });
  test("a voice started early (by key) also serves 🔁 Again for the saved line: no second fetch", async () => {
    const { player, fetched } = fakePlayer();
    player.unlock();
    await player.play("key-abc");
    player.alias(42, "key-abc");
    await player.play(42);
    expect(fetched).toEqual(["key-abc"]);
  });
  test("mouth shapes follow loudness", () => {
    expect([0, 0.2, 0.6].map(mouthFor)).toEqual(["closed", "open", "wide"]);
  });
});

describe("Laddu's self-introduction on the welcome screen (spec 003)", () => {
  test("the voice reads the Tamil-script line, made once and kept (one voice call)", async () => {
    forgetIntroVoice();
    const voice = new FakeVoice();
    const log = memoryLog();
    await introVoice(voice, log);
    await introVoice(voice, log);
    expect(voice.calls).toEqual([INTRO_TAMIL]);
    expect(log.entries).toHaveLength(1);
  });
  test("if the voice fails, the next visit tries again", async () => {
    forgetIntroVoice();
    await expect(introVoice(new FakeVoice(true), memoryLog())).rejects.toThrow();
    const voice = new FakeVoice();
    await introVoice(voice, memoryLog());
    expect(voice.calls).toHaveLength(1);
    forgetIntroVoice();
  });
  test("what the screen shows has no Tamil script", () => {
    expect(hasTamilScript(INTRO)).toBe(false);
    expect(INTRO.tanglish).toBe("Vanakkam! Naan Laddu. Tamil-la pesalaam!");
  });
});
