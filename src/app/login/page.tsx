"use client";
// Magic-link login: type your email, get a link, tap it, you're in. Only emails
// on the allowlist can sign up; Supabase rejects everyone else.
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  // /auth/callback sends you back here with ?error=link if the link didn't work.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "link")
      setError("That sign-in link has expired or was already used. Request a new one.");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setState("idle");
      setError(/invite-only|403|not allowed/i.test(error.message)
        ? "This app is invite-only. Ask Nisha to add your email."
        : error.message);
    } else setState("sent");
  }

  return (
    <div className="login">
      <h1>Vaanga! 👋</h1>
      <p className="muted">Practice spoken Tamil a few minutes a day.</p>
      {state === "sent" ? (
        <p>Check your email for a sign-in link. You can close this tab.</p>
      ) : (
        <form onSubmit={submit}>
          <label>
            Email
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Email me a sign-in link"}</button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </div>
  );
}
