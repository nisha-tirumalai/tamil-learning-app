"use client";
// If something on a page breaks (e.g. a chat couldn't be started), show a
// friendly message with a way to try again, instead of a blank or frozen screen.
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="welcome">
      <p className="tanglish">Aiyo! Something went wrong.</p>
      <p className="muted">Please try again. If it keeps happening, tell Nisha.</p>
      <button type="button" onClick={() => { reset(); window.location.reload(); }}>Try again</button>
    </div>
  );
}
