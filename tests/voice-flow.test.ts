// Spec 003: a whole spoken turn against a throwaway local Supabase, with a
// fake model, fake hearing and fake voice (no keys, no cost). Skipped unless
// TEST_SUPABASE_* are set (run with `npm run test:db`).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { dbLog, memoryLog } from "@/lib/calls";
import { ERROR_TEXT } from "@/lib/chat/config";
import { FakeModel } from "@/lib/chat/model";
import {
  fixHeard, getConversation, replyStream, sendTurn, startConversation, talkTurn, type TurnEvent, voiceText,
} from "@/lib/chat/turn";
import { HEARING_ERROR_TEXT, TOO_LONG_TEXT, TOO_SHORT_TEXT } from "@/lib/voice/config";
import { takeVoice, withEarlyVoice } from "@/lib/voice/prepared";
import { FakeVoice } from "@/lib/voice/services";
import { FakeHearing } from "@/lib/voice/services";
import { goodAnswer } from "./fixtures";

const url = process.env.TEST_SUPABASE_URL;
const anonKey = process.env.TEST_SUPABASE_ANON_KEY;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && anonKey && serviceKey);

const run = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const email = `voice-${run}@test.local`;
const password = `pw-${run}`;

async function collect(events: AsyncIterable<TurnEvent>) {
  const all: TurnEvent[] = [];
  for await (const e of events) all.push(e);
  return all;
}
const answer = (over: Record<string, unknown> = {}) => ({ ...goodAnswer, ...over });
const audio = (bytes = 20_000) => new Blob([new Uint8Array(bytes)], { type: "audio/webm" });
const REPLY = "Ooh, Mysore pak-aa! Evlo venum?\nOoh, Mysore pak! How much do you need?\nஓ, மைசூர் பாக்கா! எவ்ளோ வேணும்?";

describe.skipIf(!configured)("talking to Laddu (fake services)", () => {
  let admin: SupabaseClient, db: SupabaseClient, userId = "";
  const client = (key: string) => createClient(url!, key, { auth: { persistSession: false, autoRefreshToken: false } });

  beforeAll(async () => {
    admin = client(serviceKey!);
    db = client(anonKey!);
    await admin.from("allowlist").insert({ email });
    const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    userId = data.user!.id;
    expect((await db.auth.signInWithPassword({ email, password })).error).toBeNull();
  });
  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
    await admin.from("allowlist").delete().eq("email", email);
  });

  async function usedToday() {
    const { data } = await admin.from("usage_daily").select("chat_messages").eq("user_id", userId).eq("day", new Date().toISOString().slice(0, 10));
    return data?.[0]?.chat_messages ?? 0;
  }
  const talk = (model: FakeModel, hearing: FakeHearing, conversationId: string, over: { bytes?: number; ms?: number; peak?: number } = {}) =>
    collect(talkTurn(db, model, [hearing], {
      conversationId, recording: { audio: audio(over.bytes), ms: over.ms ?? 3000 }, peak: over.peak ?? 0.2, displayName: "nisha.tirumalai",
    }));

  test("a recording → text → Tanglish bubble → reply + score; Tamil script never sent to the screen", async () => {
    const convo = await startConversation(db, "me");
    const model = new FakeModel([answer()], [REPLY]);
    model.tanglishAnswers = ["Naan konjam sweets samaikkiren"];
    const hearing = new FakeHearing(["நான் கொஞ்சம் ஸ்வீட்ஸ் சமைக்கிறேன்"]);
    const before = await usedToday();

    const events = await talk(model, hearing, convo.id);
    expect(events[0]).toEqual({ t: "heard", text: "Naan konjam sweets samaikkiren" });
    expect(events.map((e) => e.t)).toEqual(expect.arrayContaining(["saved", "done", "score"]));
    expect(JSON.stringify(events)).not.toMatch(/[஀-௿]/);                     // nothing in Tamil script went out
    expect(events.find((e) => e.t === "done")).toMatchObject({ text: "Ooh, Mysore pak-aa! Evlo venum?", english: "Ooh, Mysore pak! How much do you need?" });
    expect(await usedToday()).toBe(before + 1);                                // counts like a typed message
    // Laddu starts on what was heard straight away (faster); my bubble comes out first anyway.
    expect(model.replyCalls[0].messages.at(-1)!.content).toContain("நான் கொஞ்சம் ஸ்வீட்ஸ் சமைக்கிறேன்");
    const order = events.map((e) => e.t);
    expect(order.indexOf("heard")).toBeLessThan(order.indexOf("saved"));
    expect(order.indexOf("saved")).toBeLessThan(order.indexOf("delta"));
    expect(model.scoreCalls[0].message).toContain("Naan konjam sweets samaikkiren");

    // Saved: my spoken message (with what was heard), Laddu's hidden Tamil line.
    const { data } = await db.from("messages").select("role, text, heard, spoken, tamil").eq("conversation_id", convo.id).order("id");
    expect(data).toEqual([
      { role: "me", text: "Naan konjam sweets samaikkiren", heard: "Naan konjam sweets samaikkiren", spoken: true, tamil: null },
      { role: "laddu", text: "Ooh, Mysore pak-aa! Evlo venum?", heard: null, spoken: false, tamil: "ஓ, மைசூர் பாக்கா! எவ்ளோ வேணும்?" },
    ]);
    // The hidden Tamil-script reply goes only to the voice.
    const laddu = events.find((e) => e.t === "done") as { id: number };
    expect(await voiceText(db, laddu.id)).toBe("ஓ, மைசூர் பாக்கா! எவ்ளோ வேணும்?");
    // The screen's copy of the chat has no Tamil script.
    expect(JSON.stringify(await getConversation(db, convo.id))).not.toMatch(/[஀-௿]/);
  });

  test("too short, silent or too long recordings are rejected before any paid call and don't count", async () => {
    const convo = await startConversation(db, "me");
    const model = new FakeModel();
    const hearing = new FakeHearing(["never used"]);
    const before = await usedToday();
    expect((await talk(model, hearing, convo.id, { ms: 200 }))).toEqual([{ t: "hearing_error", problem: "too_short", message: TOO_SHORT_TEXT }]);
    expect((await talk(model, hearing, convo.id, { peak: 0.001 }))).toEqual([{ t: "hearing_error", problem: "silent", message: HEARING_ERROR_TEXT }]);
    expect((await talk(model, hearing, convo.id, { ms: 40_000 }))).toEqual([{ t: "hearing_error", problem: "too_long", message: TOO_LONG_TEXT }]);
    expect(hearing.calls).toHaveLength(0);
    expect(model.replyCalls).toHaveLength(0);
    expect(await usedToday()).toBe(before);
  });

  test("hearing fails: the friendly message, nothing saved", async () => {
    const convo = await startConversation(db, "me");
    const events = await talk(new FakeModel(), new FakeHearing([new Error("down")]), convo.id);
    expect(events).toEqual([{ t: "hearing_error", problem: "failed", message: "Aiyo, I couldn't hear that 😅 Try again or type it." }]);
    expect((await db.from("messages").select("id").eq("conversation_id", convo.id)).data).toEqual([]);
  });

  test("heard nothing (just noise): the same friendly message", async () => {
    const convo = await startConversation(db, "me");
    expect(await talk(new FakeModel(), new FakeHearing([""]), convo.id)).toEqual([{ t: "hearing_error", problem: "silent", message: HEARING_ERROR_TEXT }]);
  });

  test("fixing a mis-heard bubble re-scores the fixed text, and keeps what was heard", async () => {
    const convo = await startConversation(db, "me");
    const model = new FakeModel([answer({ grammar: 2, spoken: 1, total: 3 }), answer({ grammar: 6, spoken: 4, total: 10, mistake_types: [] })], [REPLY]);
    const events = await talk(model, new FakeHearing(["Naan konjam sweet samikiren"]), convo.id);
    const id = (events.find((e) => e.t === "saved") as { messageId: number }).messageId;

    const fixed = await fixHeard(db, model, id, "Naan konjam sweets samaikkiren");
    expect(fixed).toMatchObject({ ok: true, score: { total: 10 } });
    expect(model.scoreCalls.at(-1)!.message).toContain("Naan konjam sweets samaikkiren");
    const { data } = await db.from("messages").select("text, heard").eq("id", id).single();
    expect(data).toEqual({ text: "Naan konjam sweets samaikkiren", heard: "Naan konjam sweet samikiren" });
  });

  test("only spoken messages can be 'fixed'", async () => {
    const convo = await startConversation(db, "me");
    const model = new FakeModel([answer()], ["Sari!\nOkay!"]);
    const events = await collect(sendTurn(db, model, { conversationId: convo.id, text: "Typed", displayName: null }));
    const id = (events.find((e) => e.t === "saved") as { messageId: number }).messageId;
    expect(await fixHeard(db, model, id, "something else")).toMatchObject({ ok: false, error: ERROR_TEXT });
  });

  test("the opener is saved with its Tamil line too, and logged as 'opener'", async () => {
    const convo = await startConversation(db, "laddu");
    const model = new FakeModel([], [REPLY]);
    const events = await collect(replyStream(db, model, convo.id, "Nisha"));
    expect(model.replyCalls[0].job).toBe("opener");
    const done = events.at(-1) as { t: string; id: number };
    expect(await voiceText(db, done.id)).toContain("மைசூர்");
  });

  test("the call log: the app can add rows, but they're private (not even I can read them unless I'm an admin)", async () => {
    const log = dbLog(db);
    log.add({ service: "elevenlabs", job: "voice", model: "Charlie · eleven_multilingual_v2", ms_total: 512.4, characters: 30, cost_usd: 0.0066, ok: true });
    log.add({ service: "claude", job: "reply", model: "claude-haiku-5-5", ms_first: 300, ms_total: 900, input_tokens: 1200, output_tokens: 40, cost_usd: 0.00014, ok: true });
    await log.flush();
    // Rows are written in the background, at the same time, so they can land in either order.
    const { data: rows } = await admin.from("api_calls").select("service, job, ms_total, user_id").eq("user_id", userId);
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(expect.arrayContaining([
      { service: "elevenlabs", job: "voice", ms_total: 512, user_id: userId },
      { service: "claude", job: "reply", ms_total: 900, user_id: userId },
    ]));
    expect((await db.from("api_calls").select("id")).data).toEqual([]);           // not readable by a normal user
    expect((await db.from("api_calls").update({ ok: false }).eq("user_id", userId).select()).data ?? []).toEqual([]);
    // Someone else's rows can't be added.
    const { error } = await db.from("api_calls").insert({ user_id: "00000000-0000-0000-0000-000000000000", service: "claude", job: "reply", ok: true, ms_total: 1 });
    expect(error).not.toBeNull();
    // An admin can read them (for the phase 7 dashboard).
    await admin.from("profiles").update({ is_admin: true }).eq("id", userId);
    expect((await db.from("api_calls").select("id")).data).toHaveLength(2);
    await admin.from("profiles").update({ is_admin: false }).eq("id", userId);
  });

  test("a spoken turn's log rows hold no words, only sizes and times", async () => {
    const log = memoryLog();
    const convo = await startConversation(db, "me");
    const model = new FakeModel([answer()], [REPLY]);
    await collect(talkTurn(db, model, [new FakeHearing(["Naan secret-aa sonnen"])], {
      conversationId: convo.id, recording: { audio: audio(), ms: 4000 }, peak: 0.3, displayName: null,
    }, log));
    expect(log.entries).toEqual([expect.objectContaining({ job: "hearing", audio_seconds: 4, ok: true })]);
    expect(JSON.stringify(log.entries)).not.toContain("secret");
  });
  test("Laddu's voice starts early when wanted; muted = no voice call", async () => {
    const convo = await startConversation(db, "laddu");
    const voice = new FakeVoice();
    const muted = await collect(withEarlyVoice(replyStream(db, new FakeModel([], [REPLY]), convo.id, "Nisha"), db, false, memoryLog(), () => voice) as never);
    await new Promise((r) => setTimeout(r, 50));
    expect(voice.calls).toEqual([]);
    expect(takeVoice((muted.at(-1) as { id: number }).id)).toBeNull();

    const convo2 = await startConversation(db, "laddu");
    const log = memoryLog();
    const events = await collect(withEarlyVoice(replyStream(db, new FakeModel([], [REPLY]), convo2.id, "Nisha"), db, true, log, () => voice) as never);
    const id = (events.at(-1) as { id: number }).id;
    const audio = await takeVoice(id);
    expect(new TextDecoder().decode(audio!)).toBe("mp3:ஓ, மைசூர் பாக்கா! எவ்ளோ வேணும்?");   // the hidden Tamil line
    expect(takeVoice(id)).toBeNull();   // handed out once
    expect(log.entries).toEqual([expect.objectContaining({ job: "voice", ok: true })]);
  });
});
