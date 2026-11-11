"use client";
// The two kinds of bubble in a chat (spec 002):
//  - Laddu's: only the Tanglish; tap to show the English, tap again to hide it.
//  - Mine: my message with a small ⭐ chip under it; tap the chip to open the
//    correction card, tap again to close it. Closed by default.
import { useState } from "react";
import { chipFor } from "@/lib/chat/chip";
import type { Attempt } from "@/lib/chat/turn";
import { Laddu, Me } from "./Characters";
import { type CardActions, CorrectionCard } from "./CorrectionCard";

export function LadduBubble({ text, english, typing, defaultOpen = false }: {
  text: string; english: string; typing?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const body = <p className="tanglish">{text || (typing ? "…" : "")}</p>;
  return (
    <div className="msg laddu">
      <Laddu size={40} />
      {english && !typing
        ? (
          <button type="button" className="bubble tappable" onClick={() => setOpen(!open)} aria-expanded={open}
            aria-label={open ? undefined : `${text} (tap for the English)`}>
            {body}
            {open && <p className="english">{english}</p>}
          </button>
        )
        : <div className="bubble">{body}</div>}
    </div>
  );
}

export function MyTurn({ attempts, pending, actions, onRescore, readOnly = false, defaultOpen = false }: {
  attempts: Attempt[];
  pending: ReadonlySet<number>;
  actions?: CardActions;
  /** Tap on "Score didn't load". */
  onRescore?: () => void;
  readOnly?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const chip = chipFor(attempts, pending, readOnly);
  return (
    <div className="turn">
      <div className="msg me">
        <div className="bubble">
          {attempts.map((a, i) => (
            <p key={a.id} className={i < attempts.length - 1 ? "earlier" : ""}>{a.text}</p>
          ))}
        </div>
        <Me size={36} />
      </div>
      {chip.kind !== "none" && (
        <div className="chip-row">
          {chip.kind === "pending" && <span className="chip pending" aria-label="Score coming">{chip.label}</span>}
          {chip.kind === "failed" && <button type="button" className="chip failed" onClick={onRescore}>{chip.label}</button>}
          {chip.kind === "open" && (
            <button type="button" className="chip" onClick={() => setOpen(!open)} aria-expanded={open}>
              {chip.label} <span aria-hidden="true">{open ? "⌄" : "›"}</span>
            </button>
          )}
        </div>
      )}
      {open && chip.kind === "open" && <CorrectionCard attempts={attempts} actions={actions} />}
    </div>
  );
}
