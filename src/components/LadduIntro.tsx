"use client";
// Welcome (spec 003): before "Choose your avatar", Laddu introduces himself,
// with his voice. Phones only allow sound after a tap, and on a fresh page
// nobody has tapped yet, so he can't just start talking (bug 10). Instead a
// big "🔊 Hear Laddu" button plays him; if sound is already allowed (you
// tapped your way here), he speaks by himself.
import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import { INTRO, INTRO_VOICE_REF as INTRO_REF } from "@/lib/chat/config";
import { mouthFor, voicePlayer, type VoicePlayer } from "@/lib/voice/player";
import { Laddu } from "./Characters";
import { EnglishCard, useBlink } from "./Scene";

export function LadduIntro() {
  const player = useRef<VoicePlayer | null>(null);
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [level, setLevel] = useState(0);
  const [showEnglish, setShowEnglish] = useState(false);
  const [heard, setHeard] = useState(false);
  const [failed, setFailed] = useState(false);
  const blink = useBlink();

  const hear = async () => {
    const p = player.current;
    if (!p) return;
    p.unlock();               // this tap allows sound
    if (p.muted) p.setMuted(false);
    setFailed(false);
    const ok = await p.play(INTRO_REF);
    setHeard(true);
    if (!ok) setFailed(true);
  };

  useEffect(() => {
    const p = voicePlayer();
    player.current = p;
    p.onLevel = setLevel;
    p.onChange = refresh;
    refresh();
    // Sound already allowed (and not muted): he says hello by himself.
    if (p.unlocked && !p.muted) void p.play(INTRO_REF).then((ok) => { if (ok) setHeard(true); });
    return () => { p.stop(); p.onLevel = () => {}; p.onChange = () => {}; };
  }, []);

  const speaking = player.current?.playing != null;
  return (
    <div className="welcome intro">
      <div className="speech laddu-speech intro-speech pop has-info">
        <span className="tanglish">{INTRO.tanglish}</span>
        <button type="button" className="info-button" onClick={() => setShowEnglish(!showEnglish)} aria-expanded={showEnglish}
          aria-label="What does that mean in English?">ⓘ</button>
      </div>
      {showEnglish && <EnglishCard english={INTRO.english} onClose={() => setShowEnglish(false)} />}
      {/* Laddu grows to fit the screen (see .intro-laddu in globals.css). */}
      <div className="intro-laddu">
        <Laddu size={190} crop="full" mouth={speaking ? mouthFor(level) : "closed"} eyes={blink ? "blink" : "happy"} />
      </div>
      <div className="intro-buttons">
        <button type="button" className={heard ? "hear-again" : "hear-button"} onClick={() => void hear()} disabled={speaking}>
          {heard ? "🔁 Hear it again" : "🔊 Hear Laddu"}
        </button>
        {failed && <p className="notice-detail">Laddu&apos;s voice didn&apos;t load. Try again in a moment.</p>}
        <Link className="button-link" href="/choose-avatar">Choose your avatar (girl or guy) ›</Link>
      </div>
    </div>
  );
}
