"use client";
// The conversation scene (spec 003, as in the approved drafts, version 4):
// a soft cartoon background (sky, sun, hills, faint trees); Laddu on the left
// and me on the right, big and close together, cut off around the waist,
// facing each other. Each speech bubble sits just above its speaker's head
// (tail pointing at them) and grows upwards. Only the latest line from each of
// us is shown; earlier lines are in the "📜 Earlier" panel.
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

/**
 * Laddu's bubble. Tap it: the English shows inside. Tap ⓘ: a small card with
 * the English (`EnglishCard`, shown over the scene). Both use the English saved
 * with the reply: no extra AI or voice call.
 */
export function LadduSpeech({ line, infoOpen = false, onInfo }: {
  line: LadduLine | null; infoOpen?: boolean; onInfo?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const key = line ? `${line.kind}:${line.text}` : "";
  useEffect(() => setOpen(false), [key]);
  if (!line) return <div className="speech laddu-speech empty" aria-hidden="true" />;
  if (line.kind === "line" && line.english) {
    return (
      <div key={key} className={`speech laddu-speech pop${onInfo ? " has-info" : ""}`}>
        <button type="button" className="speech-scroll speech-tap" onClick={() => setOpen(!open)}
          aria-expanded={open} aria-label={open ? undefined : `Laddu: ${line.text} (tap for the English)`}>
          <span className="tanglish">{line.text}</span>
          {open && <span className="english">{line.english}</span>}
        </button>
        {onInfo && (
          <button type="button" className="info-button" onClick={onInfo} aria-expanded={infoOpen}
            aria-label="What does that mean in English?">ⓘ</button>
        )}
      </div>
    );
  }
  return (
    <div key={key} className={`speech laddu-speech pop${line.kind === "typing" ? " typing" : ""}`} aria-live="polite">
      <span className="speech-scroll"><span className="tanglish">{line.text || "…"}</span></span>
    </div>
  );
}

/** The ⓘ card: the English of what Laddu just said. */
export function EnglishCard({ english, onClose }: { english: string; onClose: () => void }) {
  return (
    <div className="english-card pop" role="note">
      <span className="english-card-label">In English</span>
      <p>{english}</p>
      <button type="button" className="link-button" onClick={onClose} aria-label="Close">✕</button>
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

/** The soft cartoon background from the approved drafts. Purely decoration. */
function Backdrop() {
  const tree = (x: number, y: number, k: number) => (
    <g key={x} transform={`translate(${x} ${y}) scale(${k})`}>
      <rect x="-3" y="0" width="6" height="22" rx="2" fill="#8a6a4a" />
      <circle cx="0" cy="-8" r="16" fill="#4f9e48" /><circle cx="-11" cy="2" r="11" fill="#4f9e48" /><circle cx="11" cy="2" r="11" fill="#4f9e48" />
    </g>
  );
  return (
    <svg className="backdrop" viewBox="0 0 350 470" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs><linearGradient id="scene-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7cc8f2" /><stop offset="1" stopColor="#c9ecfb" /></linearGradient></defs>
      <rect width="350" height="470" fill="url(#scene-sky)" />
      <circle cx="300" cy="58" r="30" fill="#ffd84d" /><circle cx="300" cy="58" r="40" fill="#ffd84d" opacity=".25" />
      <g fill="#fff"><ellipse cx="70" cy="70" rx="34" ry="13" /><ellipse cx="88" cy="60" rx="20" ry="14" /><ellipse cx="190" cy="40" rx="26" ry="10" /><ellipse cx="204" cy="32" rx="15" ry="11" /></g>
      <path d="M0 250 Q60 190 130 236 Q200 180 270 230 Q320 205 350 225 L350 470 L0 470 Z" fill="#8fd17a" />
      <g opacity=".32">{[[28, 228, 1], [112, 238, 0.8], [176, 214, 0.9], [236, 230, 0.75], [318, 218, 1.05]].map(([x, y, k]) => tree(x, y, k))}</g>
      <path d="M0 290 Q90 245 180 285 Q270 250 350 280 L350 470 L0 470 Z" fill="#6bbf5c" />
      <rect y="390" width="350" height="80" fill="#f7c873" />
      <g fill="#f0b456">{[0, 88, 176, 264].map((x) => <rect key={x} x={x} y="390" width="44" height="80" />)}</g>
      <g><circle cx="30" cy="300" r="5" fill="#ff6b6b" /><circle cx="30" cy="300" r="2" fill="#ffd84d" /><circle cx="320" cy="310" r="5" fill="#ff8fd8" /><circle cx="320" cy="310" r="2" fill="#fff" /><circle cx="175" cy="298" r="4" fill="#fff" /><circle cx="175" cy="298" r="1.6" fill="#ffd84d" /></g>
    </svg>
  );
}

export function Stage({ ladduMouth, ladduEyes, myMouth, myEyes, ladduBubble, myBubble, overlay }: {
  ladduMouth: Mouth; ladduEyes: Eyes; myMouth: Mouth; myEyes: Eyes;
  ladduBubble: React.ReactNode; myBubble: React.ReactNode;
  /** Something shown over the scene for a moment (the ⓘ English card). */
  overlay?: React.ReactNode;
}) {
  return (
    <div className="stage">
      <div className="scene">
        <Backdrop />
        <div className="actor laddu-actor"><Laddu crop="full" size={236} facing="right" mouth={ladduMouth} eyes={ladduEyes} /></div>
        <div className="actor me-actor"><Me crop="full" size={206} facing="left" mouth={myMouth} eyes={myEyes} /></div>
        <div className="bubble-wrap laddu-wrap">{ladduBubble}</div>
        <div className="bubble-wrap my-wrap">{myBubble}</div>
        {overlay}
      </div>
    </div>
  );
}
