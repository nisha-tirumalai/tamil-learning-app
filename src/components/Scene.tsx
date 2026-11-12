"use client";
// The conversation scene (spec 003): Laddu on the left and me on the right,
// full body, facing each other, each with a comic speech bubble whose tail
// points at the speaker. Only the latest line from each of us is shown.
// Earlier lines are in the "📜 Earlier" panel.
import { useEffect, useState } from "react";
import { chipFor } from "@/lib/chat/chip";
import type { Attempt } from "@/lib/chat/turn";
import type { Eyes, Mouth } from "./characters/style";
import { Laddu, Me } from "./Characters";

/** Blinks now and then (every 2.5–5.5 s, for 0.15 s). */
export function useBlink(): boolean {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(() => {
        setBlink(true);
        timer = setTimeout(() => { setBlink(false); next(); }, 150);
      }, 2500 + Math.random() * 3000);
    };
    next();
    return () => clearTimeout(timer);
  }, []);
  return blink;
}

export type LadduLine =
  | { kind: "line"; text: string; english: string }
  | { kind: "typing"; text: string }
  | { kind: "say"; text: string };          // a line that isn't saved (cap, couldn't hear…)

export function LadduSpeech({ line }: { line: LadduLine | null }) {
  const [open, setOpen] = useState(false);
  const key = line ? `${line.kind}:${line.text}` : "";
  useEffect(() => setOpen(false), [key]);
  if (!line) return <div className="speech laddu-speech empty" aria-hidden="true" />;
  if (line.kind === "line" && line.english) {
    return (
      <button type="button" key={key} className="speech laddu-speech pop tappable" onClick={() => setOpen(!open)}
        aria-expanded={open} aria-label={open ? undefined : `Laddu: ${line.text} (tap for the English)`}>
        <span className="speech-scroll">
          <span className="tanglish">{line.text}</span>
          {open && <span className="english">{line.english}</span>}
        </span>
      </button>
    );
  }
  return (
    <div key={key} className={`speech laddu-speech pop${line.kind === "typing" ? " typing" : ""}`} aria-live="polite">
      <span className="speech-scroll"><span className="tanglish">{line.text || "…"}</span></span>
    </div>
  );
}

export function MySpeech({ attempts, pending, listening, onChip, onRescore, onFix }: {
  attempts: Attempt[] | null;
  pending: ReadonlySet<number>;
  /** Recording or being heard: show dots. */
  listening: boolean;
  onChip: () => void;
  onRescore: () => void;
  /** Present when the latest line was spoken: tap to fix what Laddu heard. */
  onFix?: () => void;
}) {
  if (listening) {
    return <div className="speech my-speech pop listening" aria-label="Listening"><span className="dots">● ● ●</span></div>;
  }
  if (!attempts) return <div className="speech my-speech empty" aria-hidden="true" />;
  const latest = attempts.at(-1)!;
  const chip = chipFor(attempts, pending, false);
  return (
    <div key={latest.id} className="speech my-speech pop">
      {onFix
        ? (
          <button type="button" className="speech-scroll fix-tap" onClick={onFix} aria-label={`${latest.text} (tap to fix what Laddu heard)`}>
            <span className="mine-text">{latest.text}</span>
            <span className="fix-hint">✏️</span>
          </button>
        )
        : <span className="speech-scroll"><span className="mine-text">{latest.text}</span></span>}
      {chip.kind === "pending" && <span className="chip corner pending" aria-label="Score coming">{chip.label}</span>}
      {chip.kind === "failed" && <button type="button" className="chip corner failed" onClick={onRescore}>{chip.label}</button>}
      {chip.kind === "open" && <button type="button" className="chip corner" onClick={onChip}>{chip.label} ›</button>}
    </div>
  );
}

export function Stage({ ladduMouth, ladduEyes, myMouth, myEyes, ladduBubble, myBubble }: {
  ladduMouth: Mouth; ladduEyes: Eyes; myMouth: Mouth; myEyes: Eyes;
  ladduBubble: React.ReactNode; myBubble: React.ReactNode;
}) {
  return (
    <div className="stage">
      <div className="bubble-row laddu-row">{ladduBubble}</div>
      <div className="bubble-row my-row">{myBubble}</div>
      <div className="people">
        <div className="who laddu-who"><Laddu crop="full" size={200} facing="right" mouth={ladduMouth} eyes={ladduEyes} /></div>
        <div className="who me-who"><Me crop="full" size={180} facing="left" mouth={myMouth} eyes={myEyes} /></div>
      </div>
    </div>
  );
}
