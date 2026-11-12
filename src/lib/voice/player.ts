// Laddu's voice on the phone (spec 003). One player for the whole app:
//  - Phones only allow sound after a tap, so the first tap anywhere "unlocks"
//    it (see AudioUnlock in the root layout). After that Laddu can talk on his own.
//  - Each line's audio is fetched once and kept, so 🔁 Again and 🐢 Slow
//    replay it with no new call and no cost.
//  - 🔇 Mute: nothing is fetched at all (no voice call), and it's remembered.
//  - While he talks, `onLevel` reports how loud he is (0–1), ~60 times a
//    second, which moves his mouth.
// Browser-only code, but every browser part is passed in, so tests can use fakes.

export interface AudioLike {
  src: string;
  playbackRate: number;
  preservesPitch?: boolean;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  play(): Promise<void>;
  pause(): void;
}

export interface PlayerDeps {
  fetchAudio(messageId: number): Promise<Blob>;
  createAudio(): AudioLike;
  toUrl(blob: Blob): string;
  storage?: { get(key: string): string | null; set(key: string, value: string): void };
  /** Measures loudness; missing (or failing) → a simple open/close wobble instead. */
  meter?(audio: AudioLike): (() => number) | null;
  frame?(fn: () => void): void;
  /** Called during a tap to let sound through (e.g. resume an AudioContext). */
  onUnlock?(audio: AudioLike): void;
}

const MUTE_KEY = "laddu-muted";
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export class VoicePlayer {
  muted: boolean;
  unlocked = false;
  /** The line playing now, or null. */
  playing: number | null = null;
  onLevel: (level: number) => void = () => {};
  onChange: () => void = () => {};

  private audio: AudioLike | null = null;
  private cache = new Map<number, Promise<string>>();
  private level: (() => number) | null = null;
  private meterTried = false;
  private run = 0;

  constructor(private deps: PlayerDeps) {
    let saved: string | null = null;
    try { saved = deps.storage?.get(MUTE_KEY) ?? null; } catch { /* private mode */ }
    this.muted = saved === "1";
  }

  private element(): AudioLike {
    this.audio ??= this.deps.createAudio();
    return this.audio;
  }

  /** Call from inside a tap. Safe to call many times. */
  unlock() {
    if (this.unlocked) return;
    const a = this.element();
    try {
      this.deps.onUnlock?.(a);
      if (!this.playing) {
        a.src = SILENT;
        a.play().catch(() => {});
      }
      this.unlocked = true;
      this.onChange();
    } catch { /* try again on the next tap */ }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try { this.deps.storage?.set(MUTE_KEY, muted ? "1" : "0"); } catch { /* fine */ }
    if (muted) this.stop();
    this.onChange();
  }

  /** Fetches (once) and plays one of Laddu's lines. false = didn't play (muted, locked or failed). */
  async play(messageId: number, rate = 1): Promise<boolean> {
    if (this.muted || !this.unlocked) return false;
    const run = ++this.run;
    let url = this.cache.get(messageId);
    if (!url) {
      url = this.deps.fetchAudio(messageId).then((b) => this.deps.toUrl(b));
      this.cache.set(messageId, url);
      url.catch(() => this.cache.delete(messageId));
    }
    let src: string;
    try { src = await url; } catch { return false; }
    if (run !== this.run || this.muted) return false;   // something newer started meanwhile

    const a = this.element();
    a.pause();
    a.src = src;
    a.playbackRate = rate;
    a.preservesPitch = true;   // slow, but the same voice
    if (!this.meterTried) {
      this.meterTried = true;
      try { this.level = this.deps.meter?.(a) ?? null; } catch { this.level = null; }
    }
    const finish = () => { if (run === this.run) this.end(); };
    a.onended = finish;
    a.onerror = finish;
    this.playing = messageId;
    this.onChange();
    try {
      await a.play();
    } catch {
      this.end();
      return false;
    }
    this.animate(run);
    return true;
  }

  stop() {
    this.run++;
    this.audio?.pause();
    this.end();
  }

  private end() {
    if (this.playing === null) return;
    this.playing = null;
    this.onLevel(0);
    this.onChange();
  }

  private animate(run: number) {
    const frame = this.deps.frame;
    if (!frame) return;
    const started = Date.now();
    const tick = () => {
      if (run !== this.run || this.playing === null) return;
      let level = this.level?.() ?? -1;
      // No meter: a gentle open/close wobble, about 4 times a second.
      if (level < 0) level = 0.25 + 0.25 * Math.sin(((Date.now() - started) / 1000) * Math.PI * 8);
      this.onLevel(level);
      frame(tick);
    };
    frame(tick);
  }
}

/** Mouth shape for a loudness level. */
export function mouthFor(level: number): "closed" | "open" | "wide" {
  if (level > 0.32) return "wide";
  if (level > 0.1) return "open";
  return "closed";
}

// ─── The real one, in the browser ──────────────────────────────────────────

let shared: VoicePlayer | null = null;
let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (context) return context;
  const AC = typeof window !== "undefined"
    ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
    : undefined;
  context = AC ? new AC() : null;
  return context;
}

/** The app's one voice player (browser only). */
export function voicePlayer(): VoicePlayer {
  if (shared) return shared;
  shared = new VoicePlayer({
    async fetchAudio(id) {
      const res = await fetch(`/api/speech/${id}`);
      if (!res.ok) throw new Error(`voice ${res.status}`);
      return res.blob();
    },
    createAudio: () => {
      const a = new Audio();
      a.setAttribute("playsinline", "");
      return a as unknown as AudioLike;
    },
    toUrl: (b) => URL.createObjectURL(b),
    storage: { get: (k) => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v) },
    onUnlock() {
      // iPhone: play even when the ring/silent switch is on silent.
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      try { if (nav.audioSession) nav.audioSession.type = "playback"; } catch { /* older Safari */ }
      void audioContext()?.resume().catch(() => {});
    },
    meter(a) {
      const ctx = audioContext();
      if (!ctx) return null;
      const source = ctx.createMediaElementSource(a as unknown as HTMLMediaElement);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      return levelReader(analyser, () => { if (ctx.state !== "running") void ctx.resume().catch(() => {}); });
    },
    frame: (fn) => requestAnimationFrame(fn),
  });
  return shared;
}

/** Loudness (0–1, roughly) from an analyser: the RMS of the waveform, scaled up. */
export function levelReader(analyser: AnalyserNode, beforeRead?: () => void): () => number {
  const data = new Uint8Array(analyser.fftSize);
  return () => {
    beforeRead?.();
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) { const x = (v - 128) / 128; sum += x * x; }
    return Math.min(1, Math.sqrt(sum / data.length) * 4);
  };
}

/** The shared AudioContext, for the microphone's level meter. */
export function sharedAudioContext(): AudioContext | null {
  return audioContext();
}
