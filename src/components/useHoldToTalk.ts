"use client";
// 🎤 Hold to talk (spec 003). Press and hold: the phone records. Let go: the
// recording is handed to `onDone`. Recording stops by itself at 30 s.
//  - The first time, the phone asks for microphone permission. If I say no,
//    `state` becomes "blocked" and the screen shows how to turn it on.
//  - While recording, `level` (0–1) says how loud I am (my character's mouth
//    moves with it), and the loudest moment is sent along so the server can
//    turn away silence before any paid call.
//  - Too short (a tap) or silent recordings are caught right here: `onProblem`.
//  - The microphone is released after every recording (no mic light left on).
import { useCallback, useEffect, useRef, useState } from "react";
import { HEARING_ERROR_TEXT, TOO_SHORT_TEXT, VOICE_CONFIG } from "@/lib/voice/config";
import { levelReader, sharedAudioContext } from "@/lib/voice/player";

export type MicState = "idle" | "starting" | "recording" | "blocked" | "unsupported";

/** Why a recording was turned away on the phone (shown small, to help find problems). */
export type MicProblem = "short" | "quiet" | `mic-error:${string}`;

type AudioSessionNav = Navigator & { audioSession?: { type: string } };
/**
 * iPhone: the page is set to "playback" so Laddu can be heard with the silent
 * switch on, but "playback" can also switch the microphone off. So it's
 * "play-and-record" while I hold 🎤, and back to "playback" afterwards.
 */
function audioSession(type: "play-and-record" | "playback") {
  try {
    const nav = navigator as AudioSessionNav;
    if (nav.audioSession) nav.audioSession.type = type;
  } catch { /* older Safari: nothing to do */ }
}

const MAX_MS = 30_000;

function pickType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"]
    .find((t) => MediaRecorder.isTypeSupported?.(t));
}

export function useHoldToTalk({ onDone, onProblem }: {
  onDone: (rec: { audio: Blob; ms: number; peak: number }) => void;
  onProblem: (message: string, detail: MicProblem) => void;
}) {
  const [state, setState] = useState<MicState>("idle");
  const [level, setLevel] = useState(0);
  const holding = useRef(false);
  const session = useRef<{
    recorder: MediaRecorder; stream: MediaStream; chunks: Blob[]; started: number; peak: number;
    timer: ReturnType<typeof setTimeout>; raf: number; disconnect: () => void;
  } | null>(null);
  const handlers = useRef({ onDone, onProblem });
  handlers.current = { onDone, onProblem };

  useEffect(() => {
    if (typeof navigator !== "undefined" && (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")) {
      setState("unsupported");
    }
  }, []);

  const release = (s: NonNullable<typeof session.current>) => {
    clearTimeout(s.timer);
    cancelAnimationFrame(s.raf);
    s.disconnect();
    s.stream.getTracks().forEach((t) => t.stop());
    audioSession("playback");
    setLevel(0);
  };

  const stop = useCallback(() => {
    holding.current = false;
    const s = session.current;
    if (!s) return;
    if (s.recorder.state !== "inactive") s.recorder.stop();   // → onstop below
  }, []);

  const start = useCallback(async () => {
    if (holding.current || session.current) return;
    holding.current = true;
    setState("starting");
    audioSession("play-and-record");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      holding.current = false;
      audioSession("playback");
      const name = (e as DOMException)?.name ?? "unknown";
      setState(name === "NotAllowedError" || name === "SecurityError" ? "blocked" : "idle");
      if (name !== "NotAllowedError" && name !== "SecurityError") handlers.current.onProblem(HEARING_ERROR_TEXT, `mic-error:${name}`);
      return;
    }
    // Let go while the permission question was showing: nothing to record.
    if (!holding.current) { stream.getTracks().forEach((t) => t.stop()); audioSession("playback"); setState("idle"); return; }

    const type = pickType();
    const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

    // Loudness meter (for my mouth, and to spot silence).
    let read: (() => number) | null = null;
    let disconnect = () => {};
    try {
      const ctx = sharedAudioContext();
      if (ctx) {
        void ctx.resume().catch(() => {});
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        read = levelReader(analyser);
        disconnect = () => source.disconnect();
      }
    } catch { read = null; }

    const s = {
      recorder, stream, chunks, started: performance.now(), peak: 0, heardAnything: false,
      timer: setTimeout(stop, MAX_MS), raf: 0, disconnect,
    };
    session.current = s;
    const tick = () => {
      if (session.current !== s || !read) return;
      const l = read();
      // A real microphone is never perfectly silent (there's always a little
      // hiss). Exactly zero means the meter isn't getting the sound (on iPhone
      // the audio engine can pause while recording), not that I was quiet.
      if (l > 0) s.heardAnything = true;
      // The meter's level is scaled ×4; the server's silence check uses the raw-ish 0–1 peak.
      s.peak = Math.max(s.peak, l / 4);
      setLevel(l);
      s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);

    recorder.onstop = () => {
      const ms = Math.min(performance.now() - s.started, MAX_MS);
      release(s);
      session.current = null;
      setState("idle");
      const audio = new Blob(chunks, { type: recorder.mimeType || type || "audio/webm" });
      if (ms < VOICE_CONFIG.recording.minMs) return handlers.current.onProblem(TOO_SHORT_TEXT, "short");
      // The meter couldn't hear the mic at all: don't guess, send it (peak 1 =
      // "unknown") and let the hearing service decide.
      const peak = s.heardAnything ? s.peak : 1;
      if (peak < VOICE_CONFIG.recording.minPeak) return handlers.current.onProblem(HEARING_ERROR_TEXT, "quiet");
      handlers.current.onDone({ audio, ms, peak });
    };
    // One piece at the end (no time slices): older iPhones make broken files from slices.
    recorder.start();
    setState("recording");
  }, [stop]);

  // Leaving the page mid-recording: let the mic go.
  useEffect(() => () => {
    const s = session.current;
    if (s) { s.recorder.onstop = null; if (s.recorder.state !== "inactive") s.recorder.stop(); release(s); session.current = null; }
  }, []);

  return { state, level, start, stop };
}
