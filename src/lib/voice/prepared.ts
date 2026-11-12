// Starting Laddu's voice early (spec 003, to keep replies under ~3 s): as soon
// as his line is written, the server starts making its audio, so it's ready
// (or nearly) when the phone asks /api/speech for it. Only when the phone said
// it wants the voice (not muted), so muting still means no voice call.
// Kept in this server's memory for 2 minutes; if it isn't there (e.g. another
// server answers), /api/speech simply makes it then.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CallLog } from "@/lib/calls";
import { voiceText } from "@/lib/chat/turn";
import { configuredVoice, speak, type VoiceService } from "./services";

const KEEP_MS = 120_000;
const ready = new Map<number, { until: number; audio: Promise<ArrayBuffer> }>();

export function prepareVoice(messageId: number, make: () => Promise<ArrayBuffer>) {
  const now = Date.now();
  for (const [id, e] of ready) if (e.until < now) ready.delete(id);
  const audio = make();
  audio.catch(() => {});
  ready.set(messageId, { until: now + KEEP_MS, audio });
}

/** The audio made earlier for this line, if any (each is handed out once). */
export function takeVoice(messageId: number): Promise<ArrayBuffer> | null {
  const e = ready.get(messageId);
  ready.delete(messageId);
  return e && e.until >= Date.now() ? e.audio : null;
}

/** Passes a reply stream through, starting the voice for each finished line of Laddu's. */
export async function* withEarlyVoice<E extends { t: string }>(
  events: AsyncIterable<E>, db: SupabaseClient, wantVoice: boolean, log: CallLog,
  voice: () => VoiceService = configuredVoice,
): AsyncGenerator<E> {
  for await (const e of events) {
    yield e;
    if (wantVoice && e.t === "done") {
      const id = (e as unknown as { id: number }).id;
      prepareVoice(id, async () => {
        const text = await voiceText(db, id);
        if (!text) throw new Error("line not found");
        return speak(voice(), text, log);
      });
    }
  }
}
