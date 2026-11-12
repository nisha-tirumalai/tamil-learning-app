// One chat turn, start to finish (specs 001 and 002). Every function takes the signed-in
// user's Supabase client (so row-level security applies) and a model (the real
// one, or FakeModel in tests).
import type { SupabaseClient } from "@supabase/supabase-js";
import { CHAT_CONFIG, ERROR_TEXT, SITUATIONS } from "./config";
import { type ChatModel, loadPrompt, type Turn } from "./model";
import { findSituation, firstName, pickPraise, pickSituation } from "./pick";
import { type Card, checkScorerOutput, type Score, type ScorerOutput, toScore } from "./scorer";
import { hasTamilScript } from "./tamil";
import type { CallLog } from "@/lib/calls";
import { HEARING_ERROR_TEXT, TOO_LONG_TEXT, TOO_SHORT_TEXT } from "@/lib/voice/config";
import { checkRecording, type RecordingProblem, toTanglish } from "@/lib/voice/heard";
import { hear, type HearingService, type Recording } from "@/lib/voice/services";

type Db = SupabaseClient;

export interface MessageRow {
  id: number;
  role: "me" | "laddu";
  text: string;
  english: string | null;
  /** Laddu's hidden Tamil-script line (server only; buildThread never copies it). */
  tamil?: string | null;
  meant: string | null;
  retry_of: number | null;
  spoken?: boolean;
  created_at: string;
  scores: { grammar: number | null; spoken: number | null; total: number | null; mistake_types: string[]; card: Card }[]
    | { grammar: number | null; spoken: number | null; total: number | null; mistake_types: string[]; card: Card }
    | null;
}

/** `spoken`: I said it out loud (spec 003), so I can fix it if Laddu heard wrong. */
export type Attempt = { id: number; text: string; meant: string | null; score: Score | null; spoken?: boolean };

/** What the chat screen shows, in order. An original message carries its retries. */
export type ThreadItem =
  | { type: "laddu"; id: number; text: string; english: string }
  | { type: "me"; id: number; attempts: Attempt[] };

// Never add `tamil` here: this goes to the screen.
const MESSAGE_COLUMNS = "id, role, text, english, meant, retry_of, spoken, created_at, scores(grammar, spoken, total, mistake_types, card)";

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
    const attempt: Attempt = { id: row.id, text: row.text, meant: row.meant, score: scoreOf(row), ...(row.spoken ? { spoken: true } : {}) };
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

/** Server-side reads also get Laddu's Tamil line, so he sees his own earlier lines whole. */
async function loadMessages(db: Db, conversationId: string): Promise<MessageRow[]> {
  const { data, error } = await db.from("messages").select(`${MESSAGE_COLUMNS}, tamil`)
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

export function scorerPrompt(situationKey: string | null, context: string): string {
  return loadPrompt(CHAT_CONFIG.prompts.corrector, { tone: toneRule(situationKey), context });
}

export function scorerMessage(text: string, intended: string | null): string {
  return `Nisha's message: ${text}` + (intended ? `\nIntended meaning (from Nisha): ${intended}` : "");
}

/**
 * Asks, checks, and asks once more if the answer was unusable (e.g. Tamil script). null = give up.
 * A 10/10 sentence needs no fix, so its "better way" is always my own words, exactly.
 */
export async function askScorer(model: ChatModel, system: string, text: string, intended: string | null): Promise<ScorerOutput | null> {
  const message = scorerMessage(text, intended);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const checked = checkScorerOutput(await model.score({ system, message }));
      if (checked.ok) {
        const v = checked.value;
        return v.kind === "scored" && v.total === 10 ? { ...v, better: text.trim() } : v;
      }
      console.warn(`corrector_scorer answer rejected: ${checked.problem}`);
    } catch (e) {
      console.warn("corrector_scorer call failed:", (e as Error).message);
      return null;   // timeouts and outages: don't make her wait twice
    }
  }
  return null;
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

  const system = scorerPrompt(conversation.situation, contextText(rows, msg.id, conversation.situation));
  const value = await askScorer(model, system, msg.text, intended);
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

/**
 * Saves and scores one message, with no reply from Laddu. Used for Try again
 * (`retryOf` = the message being retried). New messages use sendTurn below.
 */
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
  | { t: "voice"; key: string }                     // spec 003: his voice is being made; fetch /api/speech/<key>
  | { t: "reset" }                                  // throw away what was shown so far
  | { t: "done"; id: number; text: string; english: string }
  | { t: "cap" }
  | { t: "error"; message: string };

/**
 * Splits Laddu's reply: "Tanglish line\nEnglish line\nTamil-script line".
 * The Tamil script (spec 003) is only for his voice and never goes to the screen.
 */
export function splitReply(raw: string): { text: string; english: string; tamil: string | null } {
  const lines = raw.split("\n").map((l) => l.trim().replace(/^["“]|["”]$/g, "")).filter(Boolean);
  const latin = lines.filter((l) => !hasTamilScript(l));
  const tamil = lines.filter((l) => hasTamilScript(l)).join(" ");
  return { text: latin[0] ?? "", english: latin.slice(1).join(" ").replace(/^\((.*)\)$/, "$1"), tamil: tamil || null };
}

/**
 * Reads a reply as it streams in (spec 003). Laddu writes a hidden line in
 * Tamil script (for his voice; first, in tutor prompt v4) plus his Tanglish and
 * English lines. A line is hidden if its first letter is Tamil script; every
 * other line may be shown. `voiceLine` is the hidden line once it's complete.
 * A line with no letters yet is held back until we know which kind it is.
 */
export function readReply(raw: string, finished = false): { visible: string; voiceLine: string | null } {
  const lines = raw.split("\n");
  const visible: string[] = [];
  let voiceLine: string | null = null;
  lines.forEach((line, i) => {
    const complete = finished || i < lines.length - 1;
    const first = line.match(/\p{L}/u)?.[0];
    if (!first) { if (complete && visible.length) visible.push(line); return; }   // no blank lines at the start
    if (hasTamilScript(first)) { if (complete && voiceLine === null) voiceLine = line.trim(); return; }
    visible.push(line);
  });
  // Drop a trailing line we can't place yet (no letters), so `visible` only ever grows.
  return { visible: visible.join("\n").replace(/\n+$/, (m) => (finished ? "" : m)), voiceLine };
}

/** The part of a reply (so far) that may be shown: everything except the hidden Tamil-script line. */
export function visiblePart(raw: string): string {
  return readReply(raw).visible;
}

/**
 * The chat so far, as Laddu sees it. He reads my own words (the latest
 * attempt), not the scorer's guess (spec 002), so a wrong "I understood"
 * can't send the chat off track. If I told the app what I meant, he gets that.
 */
export function tutorTurns(rows: MessageRow[], heardTurn?: string): Turn[] {
  const turns: Turn[] = [];
  for (const item of buildThread(rows)) {
    let turn: Turn;
    if (item.type === "laddu") {
      const tamil = rows.find((r) => r.id === item.id)?.tamil;
      turn = { role: "assistant", content: [item.text, item.english, tamil].filter(Boolean).join("\n") };
    }
    else {
      const meant = item.attempts.find((a) => a.meant)?.meant;
      turn = { role: "user", content: item.attempts.at(-1)!.text + (meant ? `\n(Nisha says she meant: ${meant})` : "") };
    }
    // Two of my messages in a row (Laddu's reply failed in between): join them.
    const prev = turns.at(-1);
    if (prev?.role === turn.role) prev.content += `\n${turn.content}`;
    else turns.push(turn);
  }
  if (heardTurn) {
    const content = `${heardTurn}\n(${HEARD_NOTE})`;
    const prev = turns.at(-1);
    if (prev?.role === "user") prev.content += `\n${content}`;
    else turns.push({ role: "user", content });
  }
  if (turns[0]?.role !== "user") turns.unshift({ role: "user", content: "(Start the conversation.)" });
  return turns;
}

/** Tamil script for one of Laddu's Tanglish lines, if he didn't write it himself. null = couldn't. */
async function tamilFor(model: ChatModel, tanglish: string): Promise<string | null> {
  try {
    const out = (await model.tamilScript({ system: loadPrompt(CHAT_CONFIG.prompts.tamilScript, {}), text: tanglish })).trim();
    return hasTamilScript(out) ? out.split("\n")[0].trim() : null;
  } catch (e) {
    console.warn("Tamil-script line failed:", (e as Error).message);
    return null;
  }
}

/** Added to what I said out loud, which may be in Tamil script (speech-to-text writes it that way). */
export const HEARD_NOTE = "Said out loud; this is what speech-to-text heard. Reply in Tanglish as always.";

/** Who Laddu is in this chat. He stays in that role the whole time (spec 002). */
export function sceneText(situationKey: string | null, name: string, opening: boolean): string {
  const situation = findSituation(situationKey);
  let scene = situation
    ? `## The scene\n\nRole-play: **${situation.title}**. You are playing **${situation.role}**, talking with ${name}. ` +
      `Stay in this role for the whole chat and talk the way that person really would, while still being warm and fun. ` +
      `Only drop the role if ${name} clearly changes the subject.`
    : `## The scene\n\nYou're just chatting as friends. ${name} started the conversation. Stay her friend the whole time.`;
  if (opening) scene += ` Open the conversation: set the scene and ask ${name} the first question.`;
  return scene;
}

/**
 * Laddu's reply (or opener, for "Laddu starts"), streamed. Only his first two
 * lines (Tanglish, English) are sent; the hidden Tamil-script line is saved for
 * his voice. Tamil script on the first two lines is caught before it leaves the
 * server: the attempt is dropped, retried once, then the friendly error.
 */
export async function* replyStream(
  db: Db, model: ChatModel, conversationId: string, displayName: string | null,
  opts: {
    /** Spec 003: what I just said out loud, as heard (not saved yet), so Laddu can start straight away. */
    heardTurn?: string;
    /** Laddu's line is saved only after this (so it lands after my message). */
    beforeSave?: Promise<unknown>;
    /**
     * Called as soon as his hidden Tamil-script line is complete, to start his
     * voice early. Returns a key the phone can fetch the audio with, or null.
     */
    onVoiceLine?: (tamil: string) => string | null;
  } = {},
): AsyncGenerator<ReplyEvent> {
  const conversation = await loadConversation(db, conversationId);
  const rows = await loadMessages(db, conversationId);
  const opening = rows.length === 0 && !opts.heardTurn;
  if (opening && !(await useOneMessage(db))) { yield { t: "cap" }; return; }

  const name = firstName(displayName);
  const system = loadPrompt(CHAT_CONFIG.prompts.tutor, { name, scene: sceneText(conversation.situation, name, opening) });
  const messages = tutorTurns(rows, opts.heardTurn);

  for (let attempt = 0; attempt < 2; attempt++) {
    let full = "";
    let shown = "";
    let tamil = false;
    let voiceStarted = false;
    try {
      for await (const piece of model.reply({ system, messages, job: opening ? "opener" : "reply" })) {
        full += piece;
        const { visible, voiceLine } = readReply(full);
        if (voiceLine && !voiceStarted) {
          voiceStarted = true;
          const key = opts.onVoiceLine?.(voiceLine);
          if (key) yield { t: "voice", key };
        }
        if (!visible.startsWith(shown)) { tamil = true; break; }   // shouldn't happen; treat like a bad answer
        const add = visible.slice(shown.length);
        if (!add) continue;
        if (hasTamilScript(add)) { tamil = true; break; }
        shown = visible;
        yield { t: "delta", text: add };
      }
    } catch (e) {
      console.warn("tutor reply failed:", (e as Error).message);
      yield { t: "error", message: ERROR_TEXT };
      return;
    }
    if (tamil) {
      console.warn("tutor reply had Tamil script; dropped");
      if (shown) yield { t: "reset" };
      continue;
    }
    const { text, english, tamil: written } = splitReply(full);
    if (!text) { yield { t: "error", message: ERROR_TEXT }; return; }
    // Charlie must always read Tamil script, never Tanglish (an English voice
    // reading English letters sounds English). If Laddu left it out, write it now.
    let forVoice = written;
    if (!forVoice && english) {   // (a safety reply is one English line: that one is read as it is)
      console.warn("Laddu's reply had no Tamil-script line; writing one for his voice");
      forVoice = await tamilFor(model, text);
    }
    if (forVoice && !voiceStarted) {
      voiceStarted = true;
      const key = opts.onVoiceLine?.(forVoice);
      if (key) yield { t: "voice", key };
    }
    try { await opts.beforeSave; } catch { yield { t: "error", message: ERROR_TEXT }; return; }
    const { data, error } = await db.from("messages")
      .insert({ conversation_id: conversationId, role: "laddu", text, english: english || null, tamil: forVoice })
      .select("id").single();
    if (error || !data) { yield { t: "error", message: ERROR_TEXT }; return; }
    await touch(db, conversationId);
    yield { t: "done", id: data.id, text, english };
    return;
  }
  yield { t: "reset" };
  yield { t: "error", message: ERROR_TEXT };
}

// ─── Sending a message: reply + score at the same time (spec 002) ─────────

export type TurnEvent =
  | ReplyEvent
  | { t: "heard"; text: string }                                    // spec 003: what Laddu heard me say
  | { t: "hearing_error"; message: string; problem: RecordingProblem | "failed" }
  | { t: "saved"; messageId: number }
  | { t: "score"; messageId: number; score: Score }
  | { t: "score_error"; messageId: number };

/**
 * I send a message: save it (one count against the cap), then ask for Laddu's
 * reply and the score together. Events come out as soon as either has
 * something, so neither waits for the other. A failure in one never stops the
 * other: a failed score → "score_error" (tap to retry); a failed reply →
 * "error" (tap to retry), and the score still arrives.
 */
export async function* sendTurn(
  db: Db, model: ChatModel,
  input: { conversationId: string; text: string; displayName: string | null; onVoiceLine?: (tamil: string) => string | null },
): AsyncGenerator<TurnEvent> {
  const text = input.text.trim().slice(0, 2000);
  if (!text) { yield { t: "error", message: "Type a message first." }; return; }
  if (!(await useOneMessage(db))) { yield { t: "cap" }; return; }
  const { data, error } = await db.from("messages")
    .insert({ conversation_id: input.conversationId, role: "me", text })
    .select("id").single();
  if (error || !data) { yield { t: "error", message: ERROR_TEXT }; return; }
  const messageId = data.id as number;
  yield { t: "saved", messageId };
  yield* replyAndScore(db, model, input.conversationId, messageId, input.displayName, input.onVoiceLine);
}

/** After my message is saved: Laddu's reply and the score, at the same time. */
async function* replyAndScore(
  db: Db, model: ChatModel, conversationId: string, messageId: number, displayName: string | null,
  onVoiceLine?: (tamil: string) => string | null,
): AsyncGenerator<TurnEvent> {
  // Both jobs push into one queue; this loop hands events out in arrival order.
  const queue: TurnEvent[] = [];
  let wake: (() => void) | null = null;
  let finished = false;
  const push = (e: TurnEvent) => { queue.push(e); wake?.(); wake = null; };

  const scoring = scoreMessage(db, model, messageId).then(
    (r) => push(r.ok ? { t: "score", messageId, score: r.score } : { t: "score_error", messageId }),
    (e) => { console.warn("score failed:", (e as Error).message); push({ t: "score_error", messageId }); },
  );
  const replying = (async () => {
    for await (const e of replyStream(db, model, conversationId, displayName, { onVoiceLine })) push(e);
  })().catch((e) => { console.warn("reply failed:", (e as Error).message); push({ t: "error", message: ERROR_TEXT }); });
  void Promise.all([scoring, replying]).then(() => { finished = true; wake?.(); });

  for (;;) {
    while (queue.length) yield queue.shift()!;
    if (finished) return;
    await new Promise<void>((resolve) => { wake = resolve; });
  }
}

// ─── Talking out loud (spec 003) ───────────────────────────────────────────

const PROBLEM_TEXT: Record<RecordingProblem, string> = {
  too_short: TOO_SHORT_TEXT, too_long: TOO_LONG_TEXT, silent: HEARING_ERROR_TEXT, missing: HEARING_ERROR_TEXT,
};

/**
 * I hold 🎤 and speak: check the recording (a bad one is rejected before any
 * paid call and doesn't count), count it like a typed message, hear it, turn
 * it into Tanglish, save it, then Laddu's reply + the score as for typing.
 * The audio itself is never stored.
 */
export async function* talkTurn(
  db: Db, model: ChatModel, hearing: HearingService[],
  input: {
    conversationId: string; recording: Recording; peak: number; displayName: string | null;
    onVoiceLine?: (tamil: string) => string | null;
  },
  log?: CallLog,
): AsyncGenerator<TurnEvent> {
  const { recording } = input;
  const problem = checkRecording({ bytes: recording.audio.size, ms: recording.ms, peak: input.peak });
  if (problem) { yield { t: "hearing_error", problem, message: PROBLEM_TEXT[problem] }; return; }
  if (!(await useOneMessage(db))) { yield { t: "cap" }; return; }

  let raw: string;
  try {
    raw = (await hear(hearing, recording, log)).text.trim();
  } catch {
    yield { t: "hearing_error", problem: "failed", message: HEARING_ERROR_TEXT };
    return;
  }
  if (!raw) { yield { t: "hearing_error", problem: "silent", message: HEARING_ERROR_TEXT }; return; }

  // The conversation comes first: Laddu starts replying to what was heard
  // right away, and his events go straight out. The Tanglish version for my
  // bubble and my score are made at the same time, in the background. His line
  // is saved only after mine, so the chat stays in order.
  let mineSaved!: (ok: boolean) => void;
  const saved = new Promise<void>((resolve, reject) => { mineSaved = (ok) => (ok ? resolve() : reject(new Error("not saved"))); });
  saved.catch(() => {});
  const queue: TurnEvent[] = [];
  let wake: (() => void) | null = null;
  let running = 2;
  const push = (e: TurnEvent) => { queue.push(e); wake?.(); wake = null; };
  const finished = () => { running--; wake?.(); wake = null; };

  void (async () => {
    const opts = { heardTurn: raw, beforeSave: saved, onVoiceLine: input.onVoiceLine };
    for await (const e of replyStream(db, model, input.conversationId, input.displayName, opts)) push(e);
  })().catch((e) => { console.warn("reply failed:", (e as Error).message); push({ t: "error", message: ERROR_TEXT }); }).finally(finished);

  void (async () => {
    const text = (await toTanglish(model, raw)).slice(0, 2000) || "(…)";   // never the raw text: it may be Tamil script
    push({ t: "heard", text });
    const { data, error } = await db.from("messages")
      .insert({ conversation_id: input.conversationId, role: "me", text, heard: text, spoken: true })
      .select("id").single();
    if (error || !data) { mineSaved(false); return; }   // Laddu's reply then fails too: "tap to try again"
    const messageId = data.id as number;
    push({ t: "saved", messageId });
    mineSaved(true);
    const r = await scoreMessage(db, model, messageId).catch(() => null);
    push(r?.ok ? { t: "score", messageId, score: r.score } : { t: "score_error", messageId });
  })().catch((e) => { console.warn("saving my words failed:", (e as Error).message); mineSaved(false); }).finally(finished);

  for (;;) {
    while (queue.length) yield queue.shift()!;
    if (running === 0) return;
    await new Promise<void>((resolve) => { wake = resolve; });
  }
}

/**
 * "Laddu heard wrong": I type what I really said. The fixed text replaces the
 * bubble and is scored instead (counts like a try again), so a hearing mistake
 * is never counted as my mistake. What he first heard is kept in `heard`.
 */
export async function fixHeard(db: Db, model: ChatModel, messageId: number, fixed: string): Promise<CardResult> {
  const clean = fixed.trim().slice(0, 2000);
  if (!clean) return { ok: false, messageId, reason: "error", error: "Type what you said first." };
  const { data: msg } = await db.from("messages").select("role, spoken").eq("id", messageId).single();
  if (!msg || msg.role !== "me" || !msg.spoken) return { ok: false, messageId, reason: "error", error: ERROR_TEXT };
  if (!(await useOneMessage(db))) return { ok: false, messageId, reason: "cap", error: "cap" };
  const { error } = await db.from("messages").update({ text: clean }).eq("id", messageId);
  if (error) return { ok: false, messageId, reason: "error", error: ERROR_TEXT };
  return scoreMessage(db, model, messageId);
}

/** What Laddu's voice reads for one of his lines: the hidden Tamil script, else the Tanglish. */
export async function voiceText(db: Db, messageId: number): Promise<string | null> {
  const { data } = await db.from("messages").select("role, text, tamil").eq("id", messageId).single();
  if (!data || data.role !== "laddu") return null;
  return (data.tamil as string | null) || (data.text as string);
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
