// A whole chat turn against a throwaway local Supabase, with a fake model (no
// key, no cost). Skipped unless TEST_SUPABASE_* are set (see rls.test.ts).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { CHAT_CONFIG, ERROR_TEXT, SITUATIONS } from "@/lib/chat/config";
import { FakeModel } from "@/lib/chat/model";
import {
  deleteConversation, flagMessage, getConversation, listConversations, replyStream, rescore,
  sendMessage, setMeaning, startConversation, type ReplyEvent,
} from "@/lib/chat/turn";
import { goodAnswer } from "./fixtures";

const url = process.env.TEST_SUPABASE_URL;
const anonKey = process.env.TEST_SUPABASE_ANON_KEY;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && anonKey && serviceKey);

const run = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const email = `chat-${run}@test.local`;
const password = `pw-${run}`;

async function collect(events: AsyncIterable<ReplyEvent>) {
  const all: ReplyEvent[] = [];
  for await (const e of events) all.push(e);
  return all;
}
const answer = (over: Record<string, unknown> = {}) => ({ ...goodAnswer, ...over });

describe.skipIf(!configured)("chat turn flow (fake model)", () => {
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

  test("send → card saved → try again (both scores) → continue streams a reply", async () => {
    const convo = await startConversation(db, "me");
    const model = new FakeModel(
      [answer({ grammar: 4, spoken: 2, total: 6 }), answer({ grammar: 6, spoken: 3, total: 9 })],
      ["Aiyo, enna aachu, Nisha?\nOh no, what happened, Nisha?"],
    );

    const first = await sendMessage(db, model, { conversationId: convo.id, text: "En naal nalla illa." });
    expect(first).toMatchObject({ ok: true, score: { total: 6 } });

    const retry = await sendMessage(db, model, { conversationId: convo.id, text: "Inniki naal sariyaa pogala.", retryOf: first.messageId });
    expect(retry).toMatchObject({ ok: true, score: { total: 9 } });
    // The retry was scored against what I originally meant.
    expect(model.scoreCalls[1].message).toContain(`Intended meaning (from Nisha): ${goodAnswer.understood}`);

    const events = await collect(replyStream(db, model, convo.id, "nisha.tirumalai"));
    expect(events.filter((e) => e.t === "delta").length).toBeGreaterThan(1);
    expect(events.at(-1)).toMatchObject({ t: "done", text: "Aiyo, enna aachu, Nisha?", english: "Oh no, what happened, Nisha?" });
    // Laddu was told what I meant, and the latest attempt.
    expect(model.replyCalls[0].messages.at(-1)!.content).toContain("Inniki naal sariyaa pogala.");
    expect(model.replyCalls[0].system).toContain("Nisha");

    const { thread } = await getConversation(db, convo.id);
    expect(thread.map((t) => t.type)).toEqual(["me", "laddu"]);
    expect(thread[0].type === "me" && thread[0].attempts.map((a) => a.score?.total)).toEqual([6, 9]);
  });

  test("\"That's not what I meant\" re-does the card for that meaning", async () => {
    const convo = await startConversation(db, "me");
    const model = new FakeModel([answer(), answer({ understood: "My day was long.", better: "Inniki romba neram aachu.", grammar: 3, spoken: 3, total: 6 })]);
    const first = await sendMessage(db, model, { conversationId: convo.id, text: "En naal nalla illa." });
    const again = await setMeaning(db, model, first.messageId!, "My day was long.");
    expect(again).toMatchObject({ ok: true, score: { total: 6, card: { better: "Inniki romba neram aachu." } } });
    expect(model.scoreCalls[1].message).toContain("Intended meaning (from Nisha): My day was long.");
    const { data } = await db.from("scores").select("total").eq("message_id", first.messageId);
    expect(data).toEqual([{ total: 6 }]);   // replaced, not doubled
  });

  test("a model error keeps my message, and I can try again", async () => {
    const convo = await startConversation(db, "me");
    const model = new FakeModel([new Error("timeout"), answer()]);
    const failed = await sendMessage(db, model, { conversationId: convo.id, text: "Naan office-ku poren." });
    expect(failed).toMatchObject({ ok: false, reason: "error", error: ERROR_TEXT });
    const { data } = await db.from("messages").select("text").eq("id", failed.messageId);
    expect(data).toEqual([{ text: "Naan office-ku poren." }]);
    expect(await rescore(db, model, failed.messageId!)).toMatchObject({ ok: true });
  });

  test("an answer with Tamil script is retried once, then never shown", async () => {
    const convo = await startConversation(db, "me");
    const tamil = answer({ better: "இன்னிக்கி" });
    expect(await sendMessage(db, new FakeModel([tamil, answer()]), { conversationId: convo.id, text: "a" }))
      .toMatchObject({ ok: true, score: { card: { better: goodAnswer.better } } });
    expect(await sendMessage(db, new FakeModel([tamil, tamil]), { conversationId: convo.id, text: "b" }))
      .toMatchObject({ ok: false, error: ERROR_TEXT });

    const replies = new FakeModel([], ["Enna solra, Nisha? சொல்ற\nWhat?", "Enna solra?\nWhat are you saying?"]);
    const events = await collect(replyStream(db, replies, convo.id, "Nisha"));
    expect(JSON.stringify(events)).not.toMatch(/[஀-௿]/);
    expect(events).toContainEqual({ t: "reset" });
    expect(events.at(-1)).toMatchObject({ t: "done", text: "Enna solra?" });

    const twice = await collect(replyStream(db, new FakeModel([], ["சரி\nok", "சரி\nok"]), convo.id, "Nisha"));
    expect(JSON.stringify(twice)).not.toMatch(/[஀-௿]/);
    expect(twice.at(-1)).toEqual({ t: "error", message: ERROR_TEXT });
  });

  test("all-English: no score; perfect: a praise line", async () => {
    const convo = await startConversation(db, "me");
    const model = new FakeModel([
      answer({ kind: "all_english", grammar: null, spoken: null, total: null, mistake_types: [] }),
      answer({ grammar: 6, spoken: 4, total: 10, mistake_types: [] }),
    ]);
    const english = await sendMessage(db, model, { conversationId: convo.id, text: "I went to the office" });
    expect(english).toMatchObject({ ok: true, score: { total: null, card: { kind: "all_english", praise: null } } });
    const perfect = await sendMessage(db, model, { conversationId: convo.id, text: "Naan office-ku poren." });
    expect(perfect.ok && perfect.score.card.praise?.tanglish).toBeTruthy();
  });

  test("Laddu starts: a situation from the list, never the same twice in a row, with an opener", async () => {
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      const convo = await startConversation(db, "laddu");
      expect(SITUATIONS.map((s) => s.key)).toContain(convo.situation);
      if (seen.length) expect(convo.situation).not.toBe(seen.at(-1));
      seen.push(convo.situation!);
    }
    const convo = await startConversation(db, "laddu");
    const model = new FakeModel([], ["Tea kadaiku vandhuttom! Enna order pannalaam?\nWe're at the tea shop! What shall we order?"]);
    const events = await collect(replyStream(db, model, convo.id, "Nisha"));
    expect(events.at(-1)).toMatchObject({ t: "done", text: "Tea kadaiku vandhuttom! Enna order pannalaam?" });
    expect(model.replyCalls[0].system).toContain(SITUATIONS.find((s) => s.key === convo.situation)!.role);
  });

  test("Looks wrong? saves a chat flag linked to the card", async () => {
    const convo = await startConversation(db, "me");
    const sent = await sendMessage(db, new FakeModel([answer()]), { conversationId: convo.id, text: "En naal nalla illa." });
    expect(await flagMessage(db, sent.messageId!, "teacher says this is fine")).toBe(true);
    const { data } = await db.from("flags").select("source, tanglish, english, note, message_id").eq("message_id", sent.messageId);
    expect(data).toEqual([{ source: "chat", tanglish: goodAnswer.better, english: "En naal nalla illa. (score 7/10)", note: "teacher says this is fine", message_id: sent.messageId }]);
  });

  test("past chats: newest first with topic, count and average; delete removes everything", async () => {
    const older = await startConversation(db, "me");
    await sendMessage(db, new FakeModel([answer()]), { conversationId: older.id, text: "Older chat" });
    const newer = await startConversation(db, "me");
    const model = new FakeModel([answer({ grammar: 6, spoken: 2, total: 8 }), answer({ grammar: 3, spoken: 2, total: 5 })]);
    const m = await sendMessage(db, model, { conversationId: newer.id, text: "Newest chat" });
    await sendMessage(db, model, { conversationId: newer.id, text: "Second" });

    const list = await listConversations(db);
    expect(list[0]).toMatchObject({ id: newer.id, topic: "Newest chat", messages: 2, average: 6.5 });
    expect(list.findIndex((c) => c.id === older.id)).toBeGreaterThan(0);

    expect(await deleteConversation(db, newer.id)).toBe(true);
    expect((await admin.from("messages").select("id").eq("conversation_id", newer.id)).data).toEqual([]);
    expect((await admin.from("scores").select("id").eq("message_id", m.messageId)).data).toEqual([]);
    expect((await listConversations(db)).map((c) => c.id)).not.toContain(newer.id);
  });

  test("daily cap: message 61 gets \"See you tomorrow\" and no model call", async () => {
    const convo = await startConversation(db, "me");
    // Fill today's count straight to the cap (the test user's timezone is UTC).
    const today = new Date().toISOString().slice(0, 10);
    await admin.from("usage_daily").upsert({ user_id: userId, day: today, chat_messages: CHAT_CONFIG.dailyCap });
    const model = new FakeModel([answer()]);
    expect(await sendMessage(db, model, { conversationId: convo.id, text: "Innum oru message" })).toMatchObject({ ok: false, reason: "cap" });
    expect(model.scoreCalls).toHaveLength(0);
    // A new day resets: yesterday's full count doesn't block today.
    await admin.from("usage_daily").update({ day: "2020-01-01" }).eq("user_id", userId).eq("day", today);
    expect(await sendMessage(db, model, { conversationId: convo.id, text: "Pudhu naal!" })).toMatchObject({ ok: true });
  });
});
