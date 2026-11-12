"use client";
// The chat with Laddu.
//  - Live chat (spec 003): a scene, not a text-message list. Laddu and my
//    character stand side by side with speech bubbles; only the latest line
//    from each of us shows. I hold 🎤 to talk (or type), Laddu answers out loud
//    with his mouth moving, and his words show in his bubble as captions.
//  - Read-only (past chats, and the "📜 Earlier" panel): the full list.
// When I send, Laddu's reply and my score are worked out at the same time on
// the server and come back down one stream (spec 002): his words appear as
// they're written, then he speaks; the ⭐ chip fills in when the score is ready.
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { fixWhatISaid, flag, notWhatIMeant, send, tryScoringAgain } from "@/app/chat/actions";
import { CAP_TEXT, ERROR_TEXT, NUDGE_TEXT } from "@/lib/chat/config";
import type { Score } from "@/lib/chat/scorer";
import type { Attempt, CardResult, ThreadItem, TurnEvent } from "@/lib/chat/turn";
import { HEARING_ERROR_TEXT, VOICE_CONFIG } from "@/lib/voice/config";
import { mouthFor, voicePlayer, type VoicePlayer } from "@/lib/voice/player";
import { type CardActions, CorrectionCard } from "./CorrectionCard";
import { type LadduLine, LadduSpeech, MySpeech, Stage, useBlink } from "./Scene";
import { LadduBubble, MyTurn } from "./Turns";
import { useHoldToTalk } from "./useHoldToTalk";

type Status =
  | { kind: "idle" }
  | { kind: "replying"; raw: string }
  | { kind: "hearing" }                     // my recording is on its way / being heard
  | { kind: "notice"; message: string }     // Laddu says something that isn't saved (couldn't hear…)
  | { kind: "error"; message: string; retry: () => void }
  | { kind: "nudge" }                       // Laddu hasn't answered my last message yet
  | { kind: "cap" };

/** Reads a stream of one-JSON-per-line events. */
async function readEvents(response: Response, onEvent: (e: TurnEvent) => void) {
  if (!response.ok || !response.body) throw new Error(`status ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines.filter(Boolean)) onEvent(JSON.parse(line) as TurnEvent);
  }
}

/** The full conversation as a list (past chats, and "📜 Earlier"). */
export function ChatList({ items, emptyText }: { items: ThreadItem[]; emptyText?: string }) {
  return (
    <div className="thread">
      {items.length === 0 && emptyText && <p className="muted center">{emptyText}</p>}
      {items.map((item) => item.type === "laddu"
        ? <LadduBubble key={`l${item.id}`} text={item.text} english={item.english} />
        : <MyTurn key={`m${item.id}`} attempts={item.attempts} pending={new Set()} readOnly />)}
    </div>
  );
}

export function Chat({ conversationId, initial, opener, title = null, readOnly = false }: {
  conversationId: string; initial: ThreadItem[]; opener: boolean; title?: string | null; readOnly?: boolean;
}) {
  if (readOnly) return <div className="chat"><ChatList items={initial} /></div>;
  return <LiveChat conversationId={conversationId} initial={initial} opener={opener} title={title} />;
}

function LiveChat({ conversationId, initial, opener, title }: {
  conversationId: string; initial: ThreadItem[]; opener: boolean; title: string | null;
}) {
  const [items, setItems] = useState<ThreadItem[]>(initial);
  const [pending, setPending] = useState<ReadonlySet<number>>(new Set());
  const [status, setStatus] = useState<Status>(() => initial.at(-1)?.type === "me" ? { kind: "nudge" } : { kind: "idle" });
  const [mode, setMode] = useState<"talk" | "type">("talk");
  const [text, setText] = useState("");
  const [panel, setPanel] = useState<null | { kind: "card"; id: number } | { kind: "earlier" } | { kind: "fix"; id: number }>(null);
  const started = useRef(false);

  // ─── Laddu's voice ──────────────────────────────────────────────────────
  const player = useRef<VoicePlayer | null>(null);
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [ladduLevel, setLadduLevel] = useState(0);
  const [waitingForTap, setWaitingForTap] = useState<number | null>(null);   // a line to speak once sound is allowed
  useEffect(() => {
    const p = voicePlayer();
    player.current = p;
    p.onLevel = setLadduLevel;
    p.onChange = refresh;
    refresh();
    return () => { p.stop(); p.onLevel = () => {}; p.onChange = () => {}; };
  }, []);
  const speak = useCallback(async (id: number, rate = 1) => {
    const p = player.current;
    if (!p || p.muted) return;
    if (!p.unlocked) { setWaitingForTap(id); return; }
    setWaitingForTap(null);
    await p.play(id, rate);
  }, []);
  const muted = player.current?.muted ?? false;
  const speaking = player.current?.playing != null;

  // ─── Small state helpers ───────────────────────────────────────────────
  const markPending = (id: number, on: boolean) => setPending((prev) => {
    const next = new Set(prev);
    if (on) next.add(id); else next.delete(id);
    return next;
  });
  const updateAttempt = (attemptId: number, change: (a: Attempt) => Attempt) => setItems((prev) =>
    prev.map((item) => item.type === "me" && item.attempts.some((a) => a.id === attemptId)
      ? { ...item, attempts: item.attempts.map((a) => (a.id === attemptId ? change(a) : a)) }
      : item));
  const setScore = (attemptId: number, score: Score) => updateAttempt(attemptId, (a) => ({ ...a, score }));
  const removeItem = (id: number) => setItems((prev) => prev.filter((i) => !(i.type === "me" && i.id === id)));
  const addLaddu = (id: number, tanglish: string, english: string) =>
    setItems((prev) => [...prev, { type: "laddu", id, text: tanglish, english }]);

  // ─── One turn: typed or spoken, streamed back ──────────────────────────
  async function runTurn(request: () => Promise<Response>, firstText: string | null, again: () => void) {
    const tempId = -Date.now();   // until the server gives the real id
    const spoken = firstText === null;
    if (!spoken) {
      setItems((prev) => [...prev, { type: "me", id: tempId, attempts: [{ id: tempId, text: firstText, meant: null, score: null }] }]);
      markPending(tempId, true);
      setStatus({ kind: "replying", raw: "" });
    } else {
      setStatus({ kind: "hearing" });
    }

    let saved: number | null = null;
    let raw = "";
    let over = false;
    const failReply = () => {
      if (saved === null) {
        removeItem(tempId);
        setStatus({ kind: "error", message: ERROR_TEXT, retry: again });
      } else {
        setStatus({ kind: "error", message: ERROR_TEXT, retry: () => void reply() });
      }
    };

    try {
      await readEvents(await request(), (e) => {
        switch (e.t) {
          case "heard":
            setItems((prev) => [...prev, { type: "me", id: tempId, attempts: [{ id: tempId, text: e.text, meant: null, score: null, spoken: true }] }]);
            markPending(tempId, true);
            setStatus({ kind: "replying", raw: "" });
            break;
          case "hearing_error": over = true; setStatus({ kind: "notice", message: e.message }); break;
          case "saved": {
            const id = e.messageId;
            saved = id;
            setItems((prev) => prev.map((item) => item.type === "me" && item.id === tempId
              ? { ...item, id, attempts: item.attempts.map((a) => ({ ...a, id })) } : item));
            setPending((prev) => { const next = new Set(prev); next.delete(tempId); next.add(id); return next; });
            break;
          }
          case "delta": raw += e.text; setStatus({ kind: "replying", raw }); break;
          case "reset": raw = ""; setStatus({ kind: "replying", raw }); break;
          case "done": over = true; addLaddu(e.id, e.text, e.english); setStatus({ kind: "idle" }); void speak(e.id); break;
          case "error": over = true; failReply(); break;
          case "cap": over = true; removeItem(tempId); setStatus({ kind: "cap" }); break;
          case "score": setScore(e.messageId, e.score); markPending(e.messageId, false); break;
          case "score_error": markPending(e.messageId, false); break;
        }
      });
    } catch (err) {
      console.warn("turn failed:", (err as Error).message);
    }
    // Whatever didn't arrive by the end shows as "tap to retry".
    markPending(tempId, false);
    if (saved !== null) markPending(saved, false);
    if (!over) {
      if (spoken && saved === null) setStatus({ kind: "notice", message: HEARING_ERROR_TEXT });
      else failReply();
    }
  }

  function sendTyped(message: string) {
    const clean = message.trim();
    const go = () => void runTurn(() => fetch(`/api/chat/${conversationId}/send`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: clean }),
    }), clean, go);
    go();
  }

  function sendSpoken(rec: { audio: Blob; ms: number; peak: number }) {
    const go = () => {
      const form = new FormData();
      form.append("audio", rec.audio, "recording");
      form.append("ms", String(Math.round(rec.ms)));
      form.append("peak", String(rec.peak));
      void runTurn(() => fetch(`/api/chat/${conversationId}/talk`, { method: "POST", body: form }), null, go);
    };
    go();
  }

  // ─── Laddu's reply on its own (his opener, or tap to retry) ────────────
  async function reply() {
    setStatus({ kind: "replying", raw: "" });
    let raw = "";
    let over = false;
    try {
      const response = await fetch(`/api/chat/${conversationId}/reply`, { method: "POST" });
      await readEvents(response, (e) => {
        if (e.t === "delta") { raw += e.text; setStatus({ kind: "replying", raw }); }
        if (e.t === "reset") { raw = ""; setStatus({ kind: "replying", raw }); }
        if (e.t === "cap") { over = true; setStatus({ kind: "cap" }); }
        if (e.t === "error") { over = true; setStatus({ kind: "error", message: e.message, retry: () => void reply() }); }
        if (e.t === "done") { over = true; addLaddu(e.id, e.text, e.english); setStatus({ kind: "idle" }); void speak(e.id); }
      });
    } catch (err) {
      console.warn("reply failed:", (err as Error).message);
    }
    if (!over) setStatus({ kind: "error", message: ERROR_TEXT, retry: () => void reply() });
  }

  // Laddu starts: ask for the opener once, when the chat is still empty.
  useEffect(() => {
    if (opener && initial.length === 0 && !started.current) {
      started.current = true;
      void reply();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── From the card ─────────────────────────────────────────────────────
  function handle(result: CardResult, retry: () => void): boolean {
    if (result.ok) return true;
    if (result.reason === "cap") setStatus({ kind: "cap" });
    else if (result.messageId === undefined) setStatus({ kind: "error", message: result.error, retry });
    return false;
  }

  async function rescoreSaved(messageId: number) {
    markPending(messageId, true);
    const result = await tryScoringAgain(messageId);
    if (result.ok) setScore(messageId, result.score);
    markPending(messageId, false);
    handle(result, () => void rescoreSaved(messageId));
  }

  async function retry(originalId: number, attemptText: string) {
    const result = await send(conversationId, attemptText, originalId);
    if (result.messageId !== undefined) {
      const attempt: Attempt = { id: result.messageId, text: attemptText.trim(), meant: null, score: result.ok ? result.score : null };
      setItems((prev) => prev.map((item) => item.type === "me" && item.id === originalId
        ? { ...item, attempts: [...item.attempts, attempt] } : item));
    }
    handle(result, () => void retry(originalId, attemptText));
  }

  async function meant(messageId: number, meaning: string) {
    markPending(messageId, true);
    const result = await notWhatIMeant(messageId, meaning);
    if (result.ok) updateAttempt(messageId, (a) => ({ ...a, meant: meaning.trim(), score: result.score }));
    markPending(messageId, false);
    if (!result.ok && result.reason === "cap") setStatus({ kind: "cap" });
    else if (!result.ok) setStatus({ kind: "error", message: result.error, retry: () => void meant(messageId, meaning) });
  }

  /** Laddu heard wrong: the text I type replaces the bubble and is scored instead. */
  async function fix(messageId: number, fixed: string) {
    const clean = fixed.trim();
    updateAttempt(messageId, (a) => ({ ...a, text: clean, score: null }));
    markPending(messageId, true);
    const result = await fixWhatISaid(messageId, clean);
    if (result.ok) setScore(messageId, result.score);
    markPending(messageId, false);
    if (!result.ok && result.reason === "cap") setStatus({ kind: "cap" });
  }

  // ─── Hold to talk ──────────────────────────────────────────────────────
  const mic = useHoldToTalk({
    onDone: sendSpoken,
    onProblem: (message) => setStatus({ kind: "notice", message }),
  });
  const micUnavailable = mic.state === "blocked" || mic.state === "unsupported";
  useEffect(() => { if (micUnavailable) setMode("type"); }, [micUnavailable]);

  const busy = status.kind === "replying" || status.kind === "hearing";
  const recording = mic.state === "recording" || mic.state === "starting";

  // ─── What the scene shows ──────────────────────────────────────────────
  const lastLaddu = [...items].reverse().find((i) => i.type === "laddu");
  const lastMine = [...items].reverse().find((i) => i.type === "me");
  let ladduLine: LadduLine | null = lastLaddu?.type === "laddu" ? { kind: "line", text: lastLaddu.text, english: lastLaddu.english } : null;
  if (status.kind === "replying") ladduLine = { kind: "typing", text: status.raw.split("\n")[0] };
  if (status.kind === "notice") ladduLine = { kind: "say", text: status.message };
  if (status.kind === "cap") ladduLine = { kind: "say", text: CAP_TEXT };
  if (!ladduLine && !opener) ladduLine = { kind: "say", text: "Enna pesalaam? Say anything in Tanglish. English words are fine!" };

  const blinkL = useBlink();
  const blinkMe = useBlink();
  const latestScore = lastMine?.type === "me" ? lastMine.attempts.at(-1)!.score?.total ?? null : null;
  const ladduEyes = blinkL ? "blink" : status.kind === "replying" ? "up" : latestScore !== null && latestScore >= 9 ? "happy" : "open";
  const ladduMouth = speaking ? mouthFor(ladduLevel) : "closed";
  const myMouth = recording ? mouthFor(mic.level) : "closed";
  const mineAttempts = lastMine?.type === "me" ? lastMine.attempts : null;
  const mineLatest = mineAttempts?.at(-1);
  const cardItem = panel?.kind === "card" ? items.find((i) => i.type === "me" && i.id === panel.id) : undefined;
  const fixAttempt = panel?.kind === "fix" ? mineAttempts?.find((a) => a.id === panel.id) : undefined;

  const cardActions = (item: Extract<ThreadItem, { type: "me" }>): CardActions | undefined => item.id < 0 ? undefined : {
    onRetry: (t) => retry(item.id, t),
    onMeant: (m) => meant(item.attempts.at(-1)!.id, m),
    onFlag: (note) => flag(item.attempts.at(-1)!.id, note),
  };

  const voiceControls = (
    <div className="voice-controls">
        {waitingForTap !== null && !muted && (
          <button type="button" className="hear-button" onClick={() => void speak(waitingForTap)}>🔊 Tap to hear Laddu</button>
        )}
        {lastLaddu && !muted && waitingForTap === null && (
          <>
            <button type="button" className="round" onClick={() => void speak(lastLaddu.id, VOICE_CONFIG.slowRate)} aria-label="Say it slowly">🐢 Slow</button>
            <button type="button" className="round" onClick={() => void speak(lastLaddu.id)} aria-label="Say it again">🔁 Again</button>
          </>
        )}
        <button type="button" className="round" aria-pressed={muted} onClick={() => { player.current?.setMuted(!muted); setWaitingForTap(null); }}
          aria-label={muted ? "Turn Laddu's voice on" : "Mute Laddu's voice"}>{muted ? "🔇 Muted" : "🔊"}</button>
      </div>
  );

  return (
    <div className="chat scene-chat">
      <div className="scene-top">
        <span className="situation">{title ? `🎬 ${title}` : ""}</span>
        <button type="button" className="link-button earlier-button" onClick={() => setPanel({ kind: "earlier" })}
          disabled={items.length === 0}>📜 Earlier</button>
      </div>

      <Stage
        ladduMouth={ladduMouth} ladduEyes={ladduEyes} myMouth={myMouth} myEyes={blinkMe ? "blink" : "open"}
        ladduBubble={<><LadduSpeech line={ladduLine} />{voiceControls}</>}
        myBubble={(
          <MySpeech
            attempts={mineAttempts}
            pending={pending}
            listening={recording || status.kind === "hearing"}
            onChip={() => lastMine && setPanel({ kind: "card", id: lastMine.id })}
            onRescore={() => mineLatest && void rescoreSaved(mineLatest.id)}
            onFix={mineLatest?.spoken && mineLatest.id > 0 ? () => setPanel({ kind: "fix", id: mineLatest.id }) : undefined}
          />
        )}
      />

      {status.kind === "error" && <button className="error-box" onClick={status.retry}>{status.message}</button>}
      {status.kind === "nudge" && <button className="nudge-box" onClick={() => void reply()}>{NUDGE_TEXT}</button>}

      {status.kind !== "cap" && (mode === "talk" ? (
        <div className="talk-bar">
          <button
            type="button"
            className={`mic${recording ? " on" : ""}`}
            disabled={busy}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture?.(e.pointerId);
              player.current?.stop();
              if (status.kind === "notice" || status.kind === "error") setStatus({ kind: "idle" });
              void mic.start();
            }}
            onPointerUp={() => mic.stop()}
            onPointerCancel={() => mic.stop()}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Hold to talk"
          >
            {recording ? "🎙️ Listening… let go to send" : busy ? "…" : "🎤 Hold to talk"}
          </button>
          <button type="button" className="link-button switch-mode" onClick={() => setMode("type")}>⌨️ Type instead</button>
        </div>
      ) : (
        <div className="type-bar">
          {mic.state === "blocked" && (
            <p className="mic-help small">
              🎤 Laddu can&apos;t hear you: the microphone is blocked. On iPhone: Settings → Safari → Microphone → Allow
              (or tap <b>aA</b> in the address bar → Website Settings → Microphone). Typing works meanwhile.
            </p>
          )}
          {mic.state === "unsupported" && (
            <p className="mic-help small">🎤 This browser can&apos;t record here. Typing works fine.</p>
          )}
          <form className="composer" onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim() || busy) return;
            const message = text; setText("");
            if (status.kind === "notice") setStatus({ kind: "idle" });
            sendTyped(message);
          }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type in Tanglish…"
              maxLength={2000} autoCapitalize="none" autoComplete="off" aria-label="Your message" />
            <button disabled={busy || !text.trim()}>Send</button>
          </form>
          {!micUnavailable && (
            <button type="button" className="link-button switch-mode" onClick={() => setMode("talk")}>🎤 Talk instead</button>
          )}
        </div>
      ))}

      {panel && (
        <div className="panel-backdrop" onClick={() => setPanel(null)}>
          <div className="panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="link-button panel-close" onClick={() => setPanel(null)} aria-label="Close">✕</button>
            {panel.kind === "earlier" && <><h2>Earlier</h2><ChatList items={items} /></>}
            {panel.kind === "card" && cardItem?.type === "me" && (
              <CorrectionCard attempts={cardItem.attempts} actions={cardActions(cardItem)} />
            )}
            {panel.kind === "fix" && fixAttempt && (
              <FixForm heard={fixAttempt.text} onSave={(t) => { setPanel(null); void fix(fixAttempt.id, t); }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FixForm({ heard, onSave }: { heard: string; onSave: (text: string) => void }) {
  const [value, setValue] = useState(heard);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSave(value); }}>
      <h2>Laddu heard wrong?</h2>
      <label>
        Type what you really said (in Tanglish). This is what gets scored.
        <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={2000} autoCapitalize="none" autoComplete="off" autoFocus />
      </label>
      <button disabled={!value.trim() || value.trim() === heard.trim()}>Fix it</button>
    </form>
  );
}
