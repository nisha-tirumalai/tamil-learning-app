"use client";
// The chat screen: Laddu's bubbles on the left, mine on the right with a
// correction card under each. Laddu only replies when I tap Continue.
import { useEffect, useRef, useState } from "react";
import { flag, notWhatIMeant, send, tryScoringAgain } from "@/app/chat/actions";
import { CAP_TEXT } from "@/lib/chat/config";
import type { Attempt, CardResult, ReplyEvent, ThreadItem } from "@/lib/chat/turn";
import { Laddu, Me } from "./Characters";
import { CorrectionCard } from "./CorrectionCard";

type Status =
  | { kind: "idle" }
  | { kind: "scoring" }
  | { kind: "replying"; raw: string }
  | { kind: "error"; message: string; retry: () => void }
  | { kind: "cap" };

function LadduBubble({ text, english, typing }: { text: string; english: string; typing?: boolean }) {
  return (
    <div className="msg laddu">
      <Laddu size={40} />
      <div className="bubble">
        <p className="tanglish">{text || (typing ? "…" : "")}</p>
        {english && <p className="english">{english}</p>}
      </div>
    </div>
  );
}

export function Chat({ conversationId, initial, opener, readOnly = false }: {
  conversationId: string; initial: ThreadItem[]; opener: boolean; readOnly?: boolean;
}) {
  const [items, setItems] = useState<ThreadItem[]>(initial);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [text, setText] = useState("");
  // The card waiting for Continue (the last message of mine, if Laddu hasn't answered it).
  const [awaiting, setAwaiting] = useState<number | null>(() => {
    const last = initial.at(-1);
    return last?.type === "me" && last.attempts.at(-1)?.score ? last.id : null;
  });
  const started = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [items, status]);

  // Laddu starts: ask for the opener once, when the chat is still empty.
  useEffect(() => {
    if (opener && !readOnly && initial.length === 0 && !started.current) {
      started.current = true;
      void reply();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function upsertAttempt(originalId: number | null, attempt: Attempt, replaceId?: number) {
    setItems((prev) => {
      if (originalId === null) return [...prev, { type: "me", id: attempt.id, attempts: [attempt] }];
      return prev.map((item) => item.type === "me" && item.id === originalId
        ? { ...item, attempts: replaceId !== undefined
            ? item.attempts.map((a) => (a.id === replaceId ? attempt : a))
            : [...item.attempts, attempt] }
        : item);
    });
  }

  /** Handles a card result; returns true if it worked. */
  function handle(result: CardResult, retry: () => void): boolean {
    if (result.ok) { setStatus({ kind: "idle" }); return true; }
    if (result.reason === "cap") setStatus({ kind: "cap" });
    else setStatus({ kind: "error", message: result.error, retry });
    return false;
  }

  async function sendNew(message: string) {
    setStatus({ kind: "scoring" });
    setAwaiting(null);   // a new message moves on without Laddu's reply
    const result = await send(conversationId, message);
    if (result.messageId !== undefined) {
      upsertAttempt(null, { id: result.messageId, text: message.trim(), meant: null, score: result.ok ? result.score : null });
      if (result.ok) setAwaiting(result.messageId);
    }
    handle(result, () => (result.messageId !== undefined ? rescoreSaved(result.messageId, result.messageId) : sendNew(message)));
  }

  async function rescoreSaved(originalId: number, messageId: number) {
    setStatus({ kind: "scoring" });
    const result = await tryScoringAgain(messageId);
    if (result.ok) {
      setItems((prev) => prev.map((item) => item.type === "me" && item.id === originalId
        ? { ...item, attempts: item.attempts.map((a) => (a.id === messageId ? { ...a, score: result.score } : a)) }
        : item));
      setAwaiting(originalId);
    }
    handle(result, () => rescoreSaved(originalId, messageId));
  }

  async function retry(originalId: number, attemptText: string) {
    setStatus({ kind: "scoring" });
    const result = await send(conversationId, attemptText, originalId);
    if (result.messageId !== undefined) {
      upsertAttempt(originalId, { id: result.messageId, text: attemptText.trim(), meant: null, score: result.ok ? result.score : null });
    }
    handle(result, () => (result.messageId !== undefined ? rescoreSaved(originalId, result.messageId) : retry(originalId, attemptText)));
  }

  async function meant(originalId: number, messageId: number, meaning: string) {
    setStatus({ kind: "scoring" });
    const result = await notWhatIMeant(messageId, meaning);
    if (result.ok) {
      setItems((prev) => prev.map((item) => item.type === "me" && item.id === originalId
        ? { ...item, attempts: item.attempts.map((a) => (a.id === messageId ? { ...a, meant: meaning.trim(), score: result.score } : a)) }
        : item));
    }
    handle(result, () => meant(originalId, messageId, meaning));
  }

  async function reply() {
    setAwaiting(null);
    setStatus({ kind: "replying", raw: "" });
    let raw = "";
    try {
      const response = await fetch(`/api/chat/${conversationId}/reply`, { method: "POST" });
      if (!response.body) throw new Error("no body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line) as ReplyEvent;
          if (event.t === "delta") { raw += event.text; setStatus({ kind: "replying", raw }); }
          if (event.t === "reset") { raw = ""; setStatus({ kind: "replying", raw }); }
          if (event.t === "cap") { setStatus({ kind: "cap" }); return; }
          if (event.t === "error") { setStatus({ kind: "error", message: event.message, retry: () => void reply() }); return; }
          if (event.t === "done") {
            setItems((prev) => [...prev, { type: "laddu", id: event.id, text: event.text, english: event.english }]);
            setStatus({ kind: "idle" });
            return;
          }
        }
      }
      throw new Error("stream ended early");
    } catch {
      setStatus({ kind: "error", message: "Aiyo! Something broke on my side 😅 Tap to try again.", retry: () => void reply() });
    }
  }

  const busy = status.kind === "scoring" || status.kind === "replying";
  const lastMe = [...items].reverse().find((i) => i.type === "me")?.id;

  return (
    <div className="chat">
      <div className="thread">
        {items.length === 0 && !opener && !readOnly && (
          <p className="muted center">Say anything in Tanglish. English words are fine!</p>
        )}
        {items.map((item) => item.type === "laddu"
          ? <LadduBubble key={`l${item.id}`} text={item.text} english={item.english} />
          : (
            <div key={`m${item.id}`} className="turn">
              <div className="msg me">
                <div className="bubble">
                  {item.attempts.map((a, i) => (
                    <p key={a.id} className={i < item.attempts.length - 1 ? "earlier" : ""}>{a.text}</p>
                  ))}
                </div>
                <Me size={36} />
              </div>
              <CorrectionCard
                attempts={item.attempts}
                active={!readOnly && !busy && awaiting === item.id && item.id === lastMe}
                actions={readOnly ? undefined : {
                  onRetry: (t) => retry(item.id, t),
                  onMeant: (m) => meant(item.id, item.attempts.at(-1)!.id, m),
                  onContinue: () => void reply(),
                  onFlag: (note) => flag(item.attempts.at(-1)!.id, note),
                }}
              />
            </div>
          ))}

        {status.kind === "scoring" && <p className="muted center">Laddu is checking… 🧸</p>}
        {status.kind === "replying" && (() => {
          const [first, ...rest] = status.raw.split("\n");
          return <LadduBubble text={first} english={rest.join(" ").trim()} typing />;
        })()}
        {status.kind === "error" && (
          <button className="error-box" onClick={status.retry}>{status.message}</button>
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
