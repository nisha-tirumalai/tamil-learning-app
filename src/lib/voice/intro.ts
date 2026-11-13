// Laddu's voice for his self-introduction on the welcome screen (spec 003).
// Server only: the Tamil-script line goes to the voice service, never to the
// screen. It's the same line every time, so it's made once and kept in memory
// until the app restarts (one voice call, not one per visit).
import type { CallLog } from "@/lib/calls";
import { speak, type VoiceService } from "./services";

/** "Vanakkam! Naan Laddu. Tamil-la pesalaam!" in Tamil script, for the voice only. */
export const INTRO_TAMIL = "வணக்கம்! நான் லட்டு. தமிழ்ல பேசலாம்!";

export { INTRO_VOICE_REF as INTRO_REF } from "@/lib/chat/config";

let kept: Promise<ArrayBuffer> | null = null;

export function introVoice(service: VoiceService, log: CallLog): Promise<ArrayBuffer> {
  if (!kept) {
    kept = speak(service, INTRO_TAMIL, log);
    kept.catch(() => { kept = null; });   // failed: try again next time
  }
  return kept;
}

/** For tests. */
export function forgetIntroVoice() { kept = null; }
