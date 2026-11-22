"use client";
// "I start" / "Laddu starts" on the home screen. Starting a chat can take a
// few seconds (much longer the first time in a Codespace, while the chat page
// is built), so the tapped button says "Starting…" straight away and both
// buttons lock. Before this, nothing changed on screen and the buttons looked
// broken (bug 13).
import { useState, useTransition } from "react";
import { start } from "@/app/chat/actions";

type Who = "me" | "laddu";

export function StartButtons() {
  const [pending, startTransition] = useTransition();
  const [tapped, setTapped] = useState<Who | null>(null);

  const go = (who: Who) => {
    setTapped(who);
    startTransition(() => start(who));
  };
  const label = (who: Who, text: string) => (pending && tapped === who ? "Starting…" : text);

  return (
    <div className="start-buttons">
      <button type="button" onClick={() => go("me")} disabled={pending} aria-busy={pending && tapped === "me"}>
        {label("me", "I start")}
      </button>
      <button type="button" onClick={() => go("laddu")} disabled={pending} aria-busy={pending && tapped === "laddu"}>
        {label("laddu", "Laddu starts")}
      </button>
    </div>
  );
}
