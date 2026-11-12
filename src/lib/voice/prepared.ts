// Starting Laddu's voice early (spec 003, "the conversation comes first"): the
// moment his hidden Tamil-script line is written (it comes first in his
// reply), the server starts making the audio and tells the phone a one-time
// key. The phone fetches /api/speech/<key> and he starts talking while his
// Tanglish caption is still being written.
// Only when the phone said it wants the voice (not muted): muting still means
// no voice call. Kept in this server's memory for 2 minutes, for that person only.
import { randomUUID } from "node:crypto";
import type { CallLog } from "@/lib/calls";
import { configuredVoice, speak, type VoiceService } from "./services";

const KEEP_MS = 120_000;
const ready = new Map<string, { user: string; until: number; audio: Promise<ArrayBuffer> }>();

/** Starts making the audio for one line; returns the key to fetch it with. */
export function prepareVoice(user: string, make: () => Promise<ArrayBuffer>): string {
  const now = Date.now();
  for (const [k, e] of ready) if (e.until < now) ready.delete(k);
  const key = randomUUID();
  const audio = make();
  audio.catch(() => {});
  ready.set(key, { user, until: now + KEEP_MS, audio });
  return key;
}

/** The audio for a key, if it's this person's and not too old. Kept for replays within the 2 minutes. */
export function takeVoice(user: string, key: string): Promise<ArrayBuffer> | null {
  const e = ready.get(key);
  if (!e || e.user !== user || e.until < Date.now()) return null;
  return e.audio;
}

/**
 * For replyStream's `onVoiceLine`: when wanted, start the voice for a Tamil
 * line and hand back its key; when muted, do nothing (no voice call).
 */
export function earlyVoice(user: string, wanted: boolean, log: CallLog, voice: () => VoiceService = configuredVoice) {
  return (tamil: string): string | null => wanted ? prepareVoice(user, () => speak(voice(), tamil, log)) : null;
}
