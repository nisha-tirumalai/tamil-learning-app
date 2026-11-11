// One chat turn, start to finish (spec 001). Every function takes the signed-in
// user's Supabase client (so row-level security applies) and a model (the real
// one, or FakeModel in tests).
import type { SupabaseClient } from "@supabase/supabase-js";
import { CHAT_CONFIG, ERROR_TEXT, SITUATIONS } from "./config";
import { type ChatModel, loadPrompt, type Turn } from "./model";
import { findSituation, firstName, pickPraise, pickSituation } from "./pick";
import { type Card, checkScorerOutput, type Score, toScore } from "./scorer";
import { hasTamilScript } from "./tamil";

type Db = SupabaseClient;

export interface MessageRow {
  id: number;
  role: "me" | "laddu";
  text: string;
  english: string | null;
  meant: string | null;
  retry_of: number | null;
  created_at: string;
  scores: { grammar: number | null; spoken: number | null; total: number | null; mistake_types: string[]; card: Card }[]
    | { grammar: number | null; spoken: number | null; total: number | null; mistake_types: string[]; card: Card }
    | null;
}

export type Attempt = { id: number; text: string; meant: string | null; score: Score | null };

/** What the chat screen shows, in order. An original message carries its retries. */
export type ThreadItem =
  | { type: "laddu"; id: number; text: string; english: string }
  | { type: "me"; id: number; attempts: Attempt[] };

const MESSAGE_COLUMNS = "id, role, text, english, meant, retry_of, created_at, scores(grammar, spoken, total, mistake_types, card)";

function scoreOf(row: MessageRow): Score | null {
  const s = Array.isArray(row.scores) ? row.scores[0] : row.scores;
  return s ? { grammar: s.grammar, spoken: s.spoken, total: s.total, mistake_types: s.mistake_types, card: s.card } : null;
}

/** Groups messages into what the screen shows: each try-again sits under its original. */
export function buildThread(rows: MessageRow[]): ThreadItem[] {
  const items: ThreadItem[] = [];
  const byOriginal = new Map<number, Attempt[]>();
  for (const row of [...rows].sort((a, b) => a.id - b.id)) {
    if (row.role === "laddu") {
      items.push({ type: "laddu", id: row.id, text: row.text, english: row.english ?? "" });
      continue;
    }
    const attempt: Attempt = { id: row.id, text: row.text, meant: row.meant, score: scoreOf(row) };
    const group = row.retry_of !== null ? byOriginal.get(row.retry_of) : undefined;
    if (group) group.push(attempt);
    else {
      const attempts = [attempt];
      byOriginal.set(row.id, attempts);
      items.push({ type: "me", id: row.id, attempts });
    }
  }
  return items;
}

async function loadMessages(db: Db, conversationId: string): Promise<MessageRow[]> {
  const { data, error } = await db.from("messages").select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId).order("id");
  if (error) throw new Error(error.message);
  return data as unknown as MessageRow[];
}

async function loadConversation(db: Db, conversationId: string) {
  const { data, error } = await db.from("conversations").select("id, started_by, situation, created_at")
    .eq("id", conversationId).single();
  if (error || !data) throw new Error("Conversation not found");
  return data as { id: string; started_by: "me" | "laddu"; situation: string | null; created_at: string };
}

async function touch(db: Db, conversationId: string) {
  await db.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
}

// ─── Daily cap ─────────────────────────────────────────────────────────────

/** Counts one model call against today's cap. false = "See you tomorrow". */
export async function useOneMessage(db: Db): Promise<boolean> {
  const { data, error } = await db.rpc("bump_chat_usage", { p_cap: CHAT_CONFIG.dailyCap });
  if (error) throw new Error(error.message);
  return data !== -1;
}

// ─── Starting ──────────────────────────────────────────────────────────────

/** "I start" or "Laddu starts" (a random situation, never the same as last time). */
export async function startConversation(db: Db, startedBy: "me" | "laddu", random = Math.random) {
  let situation: string | null = null;
  if (startedBy === "laddu") {
    const { data } = await db.from("conversations").select("situation")
      .not("situation", "is", null).order("created_at", { ascending: false }).limit(1);
    situation = pickSituation(data?.[0]?.situation, random).key;
  }
  const { data, error } = await db.from("conversations").insert({ started_by: startedBy, situation })
    .select("id, situation").single();
  if (error) throw new Error(error.message);
  return data as { id: string; situation: string | null };
}

// ─── The correction card ───────────────────────────────────────────────────

export type CardResult =
  | { ok: true; messageId: number; score: Score }
  | { ok: false; messageId?: number; reason: "cap" | "error"; error: string };

function toneRule(situationKey: string | null): string {
  const s = findSituation(situationKey);
  if (!s || !s.polite) {
    return "Nisha is talking to Laddu, her close friend, so casual *nee* forms (*nee enna panra?*) are correct. Don't mark *nee* as a mistake.";
  }
  return `Laddu is playing ${s.role}. Nisha should use polite *neenga* forms with them (*neenga*, *-ngga*, *-reenga*); casual *nee* to this person is a \`spoken\` mistake.`;
}

function contextText(rows: MessageRow[], upToId: number, situationKey: string | null): string {
  const s = findSituation(situationKey);
  const lines: string[] = [s ? `Situation: ${s.title}. Laddu is playing ${s.role}.` : "Nisha is chatting with Laddu, her friend."];
  const recent = buildThread(rows.filter((r) => r.id < upToId)).slice(-6);
  for (const item of recent) {
    if (item.type === "laddu") lines.push(`Laddu: ${item.text}  (${item.english})`);
    else lines.push(`Nisha: ${item.attempts.at(-1)!.text}`);
  }
  if (lines.length === 1) lines.push("(This is the first message.)");
  return lines.join("\n");
}

/**
 * Scores one of my messages and saves (or replaces) its card. If the model
 * fails, the message itself is kept and can be scored again.
 */
export async function scoreMessage(db: Db, model: ChatModel, messageId: number): Promise<CardResult> {
  const { data: msg, error } = await db.from("messages")
    .select("id, conversation_id, role, text, meant, retry_of").eq("id", messageId).single();
  if (error || !msg || msg.role !== "me") return { ok: false, messageId, reason: "error", error: "Message not found" };
  const conversation = await loadConversation(db, msg.conversation_id);
  const rows = await loadMessages(db, msg.conversation_id);

  // A retry is scored against what I originally meant.
  let intended: string | null = msg.meant;
  if (!intended && msg.retry_of !== null) {
    const original = rows.find((r) => r.id === msg.retry_of);
    intended = original?.meant ?? (original && scoreOf(original)?.card.understood) ?? null;
  }

  const system = loadPrompt(CHAT_CONFIG.prompts.corrector, {
    tone: toneRule(conversation.situation),
    context: contextText(rows, msg.id, conversation.situation),
  });
  const message = `Nisha's message: ${msg.text}` + (intended ? `\nIntended meaning (from Nisha): ${intended}` : "");

  // Ask, check, and ask once more if the answer was unusable (e.g. Tamil script).
  let value = null;
  for (let attempt = 0; attempt < 2 && !value; attempt++) {
    try {
      const checked = checkScorerOutput(await model.score({ system, message }));
      if (checked.ok) value = checked.value;
      else console.warn(`corrector_scorer answer rejected: ${checked.problem}`);
    } catch (e) {
      console.warn("corrector_scorer call failed:", (e as Error).message);
      break;   // timeouts and outages: don't make her wait twice
    }
  }
  if (!value) return { ok: false, messageId, reason: "error", error: ERROR_TEXT };

  // Praise line: never the same as the last one in this conversation.
  const lastPraise = [...rows].reverse().map((r) => scoreOf(r)?.card.praise?.tanglish).find(Boolean);
  const score = toScore(value, pickPraise(lastPraise));

  await db.from("scores").delete().eq("message_id", messageId);
  const saved = await db.from("scores").insert({
    message_id: messageId,
    grammar: score.grammar,
    spoken: score.spoken,
    total: score.total,
    mistake_types: score.mistake_types,
    card: score.card,
    prompt_version: CHAT_CONFIG.prompts.corrector,
    model: model.name,
  });
  if (saved.error) return { ok: false, messageId, reason: "error", error: ERROR_TEXT };
  await touch(db, msg.conversation_id);
  return { ok: true, messageId, score };
}

/** I send a message (or a try-again of `retryOf`): save it, then score it. */
export async function sendMessage(
  db: Db, model: ChatModel,
  input: { conversationId: string; text: string; retryOf?: number | null },
): Promise<CardResult> {
  const text = input.text.trim().slice(0, 2000);
  if (!text) return { ok: false, reason: "error", error: "Type a message first." };
  if (!(await useOneMessage(db))) return { ok: false, reason: "cap", error: "cap" };

  // Retries always point at the first message in the chain.
  let retryOf = input.retryOf ?? null;
  if (retryOf !== null) {
    const { data } = await db.from("messages").select("retry_of").eq("id", retryOf).single();
    retryOf = data?.retry_of ?? retryOf;
  }
  const { data, error } = await db.from("messages")
    .insert({ conversation_id: input.conversationId, role: "me", text, retry_of: retryOf })
    .select("id").single();
  if (error || !data) return { ok: false, reason: "error", error: ERROR_TEXT };
  return scoreMessage(db, model, data.id);
}

/** "That's not what I meant": save what I meant, then re-do the card. */
export async function setMeaning(db: Db, model: ChatModel, messageId: number, meant: string): Promise<CardResult> {
  const clean = meant.trim().slice(0, 2000);
  if (!clean) return { ok: false, messageId, reason: "error", error: "Type what you meant first." };
  if (!(await useOneMessage(db))) return { ok: false, messageId, reason: "cap", error: "cap" };
  await db.from("messages").update({ meant: clean }).eq("id", messageId);
  return scoreMessage(db, model, messageId);
}

/** "Tap to try again" after an error: score the saved message again. */
export async function rescore(db: Db, model: ChatModel, messageId: number): Promise<CardResult> {
  if (!(await useOneMessage(db))) return { ok: false, messageId, reason: "cap", error: "cap" };
  return scoreMessage(db, model, messageId);
}

// ─── Laddu's reply ─────────────────────────────────────────────────────────

export type ReplyEvent =
  | { t: "delta"; text: string }
  | { t: "reset" }                                  // throw away what was shown so far
  | { t: "done"; id: number; text: string; english: string }
  | { t: "cap" }
  | { t: "error"; message: string };

/** Splits "Tanglish line\nEnglish line" into its two parts. */
export function splitReply(raw: string): { text: string; english: string } {
  const lines = raw.split("\n").map((l) => l.trim().replace(/^["“]|["”]$/g, "")).filter(Boolean);
  return { text: lines[0] ?? "", english: lines.slice(1).join(" ").replace(/^\((.*)\)$/, "$1") };
}

function tutorTurns(rows: MessageRow[]): Turn[] {
  const turns: Turn[] = [];
  for (const item of buildThread(rows)) {
    if (item.type === "laddu") turns.push({ role: "assistant", content: `${item.text}\n${item.english}` });
    else {
      const last = item.attempts.at(-1)!;
      const meaning = item.attempts.find((a) => a.meant)?.meant ?? item.attempts[0].score?.card.understood;
      turns.push({ role: "user", content: last.text + (meaning ? `\n(meaning: ${meaning})` : "") });
    }
  }
  if (turns[0]?.role !== "user") turns.unshift({ role: "user", content: "(Start the conversation.)" });
  return turns;
}

/**
 * Laddu's reply (or opener, for "Laddu starts"), streamed. Tamil script is
 * caught before it leaves the server: the attempt is dropped, retried once,
 * and replaced by the friendly error if it happens again.
 */
export async function* replyStream(
  db: Db, model: ChatModel, conversationId: string, displayName: string | null,
): AsyncGenerator<ReplyEvent> {
  const conversation = await loadConversation(db, conversationId);
  const rows = await loadMessages(db, conversationId);
  const opening = rows.length === 0;
  if (opening && !(await useOneMessage(db))) { yield { t: "cap" }; return; }

  const name = firstName(displayName);
  const situation = findSituation(conversation.situation);
  let scene: string;
  if (situation) {
    scene = `Role-play: ${situation.title}. You are playing ${situation.role}, talking with ${name}. Stay in that role and talk the way that person really would, while still being warm and fun.`;
  } else {
    scene = `You're just chatting as friends. ${name} started the conversation.`;
  }
  if (opening) scene += ` Open the conversation: in one sentence, set the scene and ask ${name} the first question.`;
  const system = loadPrompt(CHAT_CONFIG.prompts.tutor, { name, scene });
  const messages = tutorTurns(rows);

  for (let attempt = 0; attempt < 2; attempt++) {
    let full = "";
    let tamil = false;
    try {
      for await (const piece of model.reply({ system, messages })) {
        if (hasTamilScript(piece)) { tamil = true; break; }
        full += piece;
        yield { t: "delta", text: piece };
      }
    } catch (e) {
      console.warn("tutor reply failed:", (e as Error).message);
      yield { t: "error", message: ERROR_TEXT };
      return;
    }
    if (tamil) {
      console.warn("tutor reply had Tamil script; dropped");
      if (full) yield { t: "reset" };
      continue;
    }
    const { text, english } = splitReply(full);
    if (!text) { yield { t: "error", message: ERROR_TEXT }; return; }
    const { data, error } = await db.from("messages")
      .insert({ conversation_id: conversationId, role: "laddu", text, english: english || null })
      .select("id").single();
    if (error || !data) { yield { t: "error", message: ERROR_TEXT }; return; }
    await touch(db, conversationId);
    yield { t: "done", id: data.id, text, english };
    return;
  }
  yield { t: "reset" };
  yield { t: "error", message: ERROR_TEXT };
}

// ─── Past chats, flags, delete ─────────────────────────────────────────────

export interface ChatSummary { id: string; date: string; topic: string; messages: number; average: number | null }

export async function listConversations(db: Db): Promise<ChatSummary[]> {
  const { data, error } = await db.from("conversations")
    .select(`id, created_at, updated_at, situation, messages(${MESSAGE_COLUMNS})`)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as { id: string; created_at: string; situation: string | null; messages: MessageRow[] }[])
    .map((c) => {
      const thread = buildThread(c.messages);
      const totals = c.messages.map((m) => scoreOf(m)?.total).filter((t): t is number => typeof t === "number");
      const firstMine = thread.find((i) => i.type === "me");
      const topic = SITUATIONS.find((s) => s.key === c.situation)?.title
        ?? (firstMine?.type === "me" ? firstMine.attempts[0].text : "New chat");
      return {
        id: c.id,
        date: c.created_at,
        topic: topic.length > 60 ? `${topic.slice(0, 57)}…` : topic,
        messages: thread.length,
        average: totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : null,
      };
    });
}

export async function getConversation(db: Db, conversationId: string) {
  const conversation = await loadConversation(db, conversationId);
  return {
    ...conversation,
    title: findSituation(conversation.situation)?.title ?? null,
    thread: buildThread(await loadMessages(db, conversationId)),
  };
}

export async function deleteConversation(db: Db, conversationId: string): Promise<boolean> {
  const { data, error } = await db.from("conversations").delete().eq("id", conversationId).select("id");
  return !error && (data?.length ?? 0) > 0;
}

/** "Looks wrong?" on a card: saves my message, the better way, and a link to the score. */
export async function flagMessage(db: Db, messageId: number, note: string): Promise<boolean> {
  const { data } = await db.from("messages").select("id, text, scores(card, total)").eq("id", messageId).single();
  if (!data) return false;
  const s = Array.isArray(data.scores) ? data.scores[0] : data.scores;
  const card = s?.card as Card | undefined;
  const scorePart = typeof s?.total === "number" ? ` (score ${s.total}/10)` : "";
  const { error } = await db.from("flags").insert({
    item_id: `chat-${messageId}`,
    english: `${data.text}${scorePart}`,
    tanglish: card?.better || "(no correction)",
    note: note.trim().slice(0, 1000) || null,
    source: "chat",
    message_id: messageId,
  });
  return !error;
}
