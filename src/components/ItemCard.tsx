"use client";
// One lesson item: Tanglish (what you say), English, a spoken/formal label,
// and a "Looks wrong?" button that saves a flag with an optional note.
import { useState, useTransition } from "react";
import { flagItem } from "@/app/flags/actions";
import type { Card } from "@/lib/lessons";

const REGISTER_LABEL = { colloquial: "spoken", formal: "formal", neutral: null } as const;

export function ItemCard({ card }: { card: Card }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saved" | string>("idle");
  const [pending, startTransition] = useTransition();
  const label = REGISTER_LABEL[card.register];

  function save() {
    startTransition(async () => {
      const result = await flagItem(card.id, note);
      if (result.ok) { setStatus("saved"); setOpen(false); setNote(""); }
      else setStatus(result.error);
    });
  }

  return (
    <article className="card">
      <p className="tanglish">
        {card.speaker && <span className="speaker">{card.speaker}: </span>}
        {card.tanglish}
      </p>
      <p className="english">{card.english}</p>
      <div className="card-footer">
        {label && <span className={`tag tag-${card.register}`}>{label}</span>}
        {status === "saved" ? (
          <span className="flag-saved">Flagged ✓</span>
        ) : (
          <button type="button" className="link-button" onClick={() => setOpen(!open)} aria-expanded={open}>
            Looks wrong?
          </button>
        )}
      </div>
      {open && (
        <div className="flag-form">
          <label>
            What looks wrong? (optional)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2}
              placeholder="e.g. the English doesn't match" />
          </label>
          <div className="row">
            <button type="button" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save flag"}</button>
            <button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button>
          </div>
          {status !== "idle" && status !== "saved" && <p className="error">{status}</p>}
        </div>
      )}
    </article>
  );
}
