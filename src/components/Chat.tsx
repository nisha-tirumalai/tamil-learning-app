"use client";
// The chat screen (spec 002): Laddu's bubbles on the left, mine on the right
// with a small ⭐ chip under each. When I send, Laddu's reply and my score are
// worked out at the same time on the server and come back down one stream:
// his words appear as they're written, and the chip fills in when the score
// is ready. Neither waits for the other.
import { useEffect, useRef, useState } from "react";
import { flag, notWhatIMeant, send, tryScoringAgain } from "@/app/chat/actions";
import { CAP_TEXT, ERROR_TEXT, NUDGE_TEXT } from "@/lib/chat/config";
import type { Score } from "@/lib/chat/scorer";
import type { Attempt, CardResult, ThreadItem, TurnEvent } from "@/lib/chat/turn";
import { LadduBubble, MyTurn } from "./Turns";

type Status =
  | { kind: "idle" }
  | { kind: "replying"; raw: string }
  | { kind: "error"; message: string; retry: () => void }
  | { kind: "nudge" }          // Laddu hasn't answered my last message yet
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

export function Chat({ conversationId, initial, opener, readOnly = false }: {
  conversationId: string; initial: ThreadItem[]; opener: boolean; readOnly?: boolean;
}) {
  const [items, setItems] = useState<ThreadItem[]>(initial);
  const [pending, setPending] = useState<ReadonlySet<number>>(new Set());
  const [status, setStatus] = useState<Status>(() =>
    !readOnly && initial.at(-1)?.type === "me" ? { kind: "nudge" } : { kind: "idle" });
  const [text, setText] = useState("");
  const started = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  // Scroll down for new bubbles, but not when a card higher up changes.
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [items.length, status]);

  // Laddu starts: ask for the opener once, when the chat is still empty.
  useEffect(() => {
    if (opener && !readOnly && initial.length === 0 && !started.current) {
      started.current = true;
      void reply();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ─── Sending a message: reply + score together ─────────────────────────
  async function sendNew(message: string) {
    const tempId = -Date.now();   // until the server gives the real id
    setItems((prev) => [...prev, { type: "me", id: tempId, attempts: [{ id: tempId, text: message.trim(), meant: null, score: null }] }]);
    markPending(tempId, true);
    setStatus({ kind: "replying", raw: "" });

    let saved: number | null = null;
    let raw = "";
    let replyOver = false;
    const failReply = () => {
      if (saved === null) {
        removeItem(tempId);
        setStatus({ kind: "error", message: ERROR_TEXT, retry: () => void sendNew(message) });
      } else {
        setStatus({ kind: "error", message: ERROR_TEXT, retry: () => void reply() });
      }
    };

    try {
      const response = await fetch(`/api/chat/${conversationId}/send`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: message }),
      });
      await readEvents(response, (e) => {
        switch (e.t) {
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
          case "done": replyOver = true; addLaddu(e.id, e.text, e.english); setStatus({ kind: "idle" }); break;
          case "error": replyOver = true; failReply(); break;
          case "cap": replyOver = true; removeItem(tempId); setStatus({ kind: "cap" }); break;
          case "score": setScore(e.messageId, e.score); markPending(e.messageId, false); break;
          case "score_error": markPending(e.messageId, false); break;
        }
      });
    } catch (err) {
      console.warn("send failed:", (err as Error).message);
    }
    // Whatever didn't arrive by the end shows as "tap to retry".
    markPending(tempId, false);
    if (saved !== null) markPending(saved, false);
    if (!replyOver) failReply();
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
        if (e.t === "done") { over = true; addLaddu(e.id, e.text, e.english); setStatus({ kind: "idle" }); }
      });
    } catch (err) {
      console.warn("reply failed:", (err as Error).message);
    }
    if (!over) setStatus({ kind: "error", message: ERROR_TEXT, retry: () => void reply() });
  }

  // ─── From the card ─────────────────────────────────────────────────────
  /** For card actions: shows the cap or a retryable error; true if it worked. */
  function handle(result: CardResult, retry: () => void): boolean {
    if (result.ok) return true;
    if (result.reason === "cap") setStatus({ kind: "cap" });
    else if (result.messageId === undefined) setStatus({ kind: "error", message: result.error, retry });
    return false;
  }

  /** "Score didn't load · tap to retry". */
  async function rescoreSaved(messageId: number) {
    markPending(messageId, true);
    const result = await tryScoringAgain(messageId);
    if (result.ok) setScore(messageId, result.score);
    markPending(messageId, false);
    handle(result, () => void rescoreSaved(messageId));
  }

  /** Try again: scored against what I first meant; Laddu doesn't reply to it. */
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

  const busy = status.kind === "replying";

  return (
    <div className="chat">
      <div className="thread">
        {items.length === 0 && !opener && !readOnly && (
          <p className="muted center">Say anything in Tanglish. English words are fine!</p>
        )}
        {items.map((item) => item.type === "laddu"
          ? <LadduBubble key={`l${item.id}`} text={item.text} english={item.english} />
          : (
            <MyTurn
              key={`m${item.id}`}
              attempts={item.attempts}
              pending={pending}
              readOnly={readOnly}
              onRescore={() => void rescoreSaved(item.attempts.at(-1)!.id)}
              actions={readOnly || item.id < 0 ? undefined : {
                onRetry: (t) => retry(item.id, t),
                onMeant: (m) => meant(item.attempts.at(-1)!.id, m),
                onFlag: (note) => flag(item.attempts.at(-1)!.id, note),
              }}
            />
          ))}

        {status.kind === "replying" && (() => {
          const [first] = status.raw.split("\n");
          return <LadduBubble text={first} english="" typing />;
        })()}
        {status.kind === "error" && (
          <button className="error-box" onClick={status.retry}>{status.message}</button>
        )}
        {status.kind === "nudge" && (
          <button className="nudge-box" onClick={() => void reply()}>{NUDGE_TEXT}</button>
        )}
        {status.kind === "cap" && <LadduBubble text={CAP_TEXT} english="" />}
        <div ref={bottom} />
      </div>

      {!readOnly && status.kind !== "cap" && (
        <form className="composer" onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim() || busy) return;
          const message = text; setText(""); void sendNew(message);
        }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type in Tanglish…"
            maxLength={2000} autoCapitalize="none" autoComplete="off" aria-label="Your message" />
          <button disabled={busy || !text.trim()}>Send</button>
        </form>
      )}
    </div>
  );
}
