"use client";
// The correction card (specs 001 + 002), opened by tapping the ⭐ chip under one
// of my messages: better way (tap for English), ⭐ score (tap for the pie),
// "I understood", mistake tags, and the buttons. Extra detail stays hidden
// until I tap. Safety messages never get a card (Laddu answers those himself).
import { useState } from "react";
import type { Attempt } from "@/lib/chat/turn";

export interface CardActions {
  onRetry: (text: string) => Promise<void>;
  onMeant: (meant: string) => Promise<void>;
  onFlag: (note: string) => Promise<boolean>;
}

function ScorePie({ grammar, spoken }: { grammar: number; spoken: number }) {
  // A ring split into grammar (of 6), spoken (of 4) and points missed.
  const r = 15.915;   // circumference 100, so lengths are percentages
  const g = grammar * 10, s = spoken * 10;
  return (
    <div className="pie">
      <svg viewBox="0 0 42 42" width="84" height="84" aria-hidden="true">
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--accent)" strokeWidth="7"
          strokeDasharray={`${g} ${100 - g}`} strokeDashoffset="25" />
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--spoken)" strokeWidth="7"
          strokeDasharray={`${s} ${100 - s}`} strokeDashoffset={25 - g} />
      </svg>
      <ul className="pie-legend">
        <li><span className="dot" style={{ background: "var(--accent)" }} />Grammar {grammar}/6</li>
        <li><span className="dot" style={{ background: "var(--spoken)" }} />Sounds like spoken Tamil {spoken}/4</li>
      </ul>
    </div>
  );
}

export function CorrectionCard({ attempts, actions }: { attempts: Attempt[]; actions?: CardActions }) {
  const latest = attempts.at(-1)!;
  const score = latest.score;
  const [showEnglish, setShowEnglish] = useState(false);
  const [showPie, setShowPie] = useState(false);
  const [more, setMore] = useState(false);
  const [panel, setPanel] = useState<"none" | "retry" | "meant" | "flag">("none");
  const [hint, setHint] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [flagged, setFlagged] = useState(false);
  if (!score || score.card.kind === "safety") return null;
  const card = score.card;
  const scored = attempts.map((a) => a.score?.total).filter((t): t is number => typeof t === "number");

  async function submit(kind: "retry" | "meant" | "flag") {
    if (!actions || busy) return;
    if (kind !== "flag" && !draft.trim()) return;
    setBusy(true);
    try {
      if (kind === "retry") await actions.onRetry(draft);
      if (kind === "meant") await actions.onMeant(draft);
      if (kind === "flag") setFlagged(await actions.onFlag(draft));
      setDraft(""); setPanel("none"); setHint(false); setMore(false); setShowEnglish(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="correction">
      <div className="correction-top">
        <button className="better" onClick={() => setShowEnglish(!showEnglish)} aria-expanded={showEnglish}>
          {card.praise ? card.praise.tanglish : card.better}
          {showEnglish && <span className="english">{card.praise ? card.praise.english : card.better_english}</span>}
        </button>
        {score.total !== null && score.grammar !== null && score.spoken !== null && (
          <button className="score" onClick={() => setShowPie(!showPie)} aria-expanded={showPie} aria-label="Score details">
            ⭐ {scored.length > 1 ? `${scored[0]} → ${scored.at(-1)}` : score.total}
          </button>
        )}
      </div>
      {!showEnglish && <p className="tap-hint">(tap for the English)</p>}
      {showPie && score.grammar !== null && score.spoken !== null && <ScorePie grammar={score.grammar} spoken={score.spoken} />}

      {card.kind === "all_english" && <p className="nudge">Try saying it in Tanglish 💪</p>}
      {card.praise && <p className="nudge">That's exactly how you'd say it.</p>}

      <p className="understood">
        I understood: “{latest.meant ?? card.understood}”
        {actions && panel !== "meant" && (
          <button className="link-button inline" onClick={() => setPanel("meant")}>That's not what I meant</button>
        )}
      </p>

      {score.mistake_types.length > 0 && (
        <p className="tags">{score.mistake_types.map((m) => <span key={m} className="tag">🏷 {m}</span>)}</p>
      )}

      {more && (
        <div className="more">
          {card.why && <p>{card.why}</p>}
          {card.alternative && <p>Another way: <strong>{card.alternative}</strong>{card.alternative_english && <span className="muted"> ({card.alternative_english})</span>}</p>}
        </div>
      )}

      {panel === "meant" && (
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); submit("meant"); }}>
          <label>What did you mean? (in English)
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} autoFocus />
          </label>
          <div className="row">
            <button disabled={busy}>{busy ? "Checking…" : "Fix the card"}</button>
            <button type="button" className="secondary" onClick={() => setPanel("none")}>Cancel</button>
          </div>
        </form>
      )}

      {panel === "retry" && (
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); submit("retry"); }}>
          {card.hint && (hint
            ? <p className="hint">💡 {card.hint}</p>
            : <button type="button" className="link-button" onClick={() => setHint(true)}>Want a hint?</button>)}
          <label>Try saying it again
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} autoFocus autoCapitalize="none" />
          </label>
          <div className="row">
            <button disabled={busy}>{busy ? "Checking…" : "Check"}</button>
            <button type="button" className="secondary" onClick={() => setPanel("none")}>Cancel</button>
          </div>
        </form>
      )}

      {panel === "flag" && (
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); submit("flag"); }}>
          <label>What looks wrong? (optional)
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} rows={2} />
          </label>
          <div className="row">
            <button disabled={busy}>{busy ? "Saving…" : "Save flag"}</button>
            <button type="button" className="secondary" onClick={() => setPanel("none")}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card-buttons">
        {(card.why || card.alternative) && !more && <button className="secondary" onClick={() => setMore(true)}>Tell me more</button>}
        {actions && panel === "none" && (
          <button className="secondary" onClick={() => setPanel("retry")}>🔁 Try again</button>
        )}
        {actions && (flagged
          ? <span className="flag-saved">Flagged ✓</span>
          : panel !== "flag" && <button className="link-button" onClick={() => setPanel("flag")}>Looks wrong?</button>)}
      </div>
    </div>
  );
}
