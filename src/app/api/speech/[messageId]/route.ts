// Laddu's voice for one of his lines (spec 003), as MP3: either by key (the
// voice was started early, see src/lib/voice/prepared.ts) or by message id.
// The voice reads the hidden Tamil-script version of the line, which never
// goes to the screen; only the audio comes back. The phone keeps the audio for 🔁 Again and
// 🐢 Slow, so those don't call the voice service again. When muted, the phone
// never asks, so no voice call is made.
import { dbLog } from "@/lib/calls";
import { voiceText } from "@/lib/chat/turn";
import { createClient } from "@/lib/supabase/server";
import { INTRO_REF, introVoice } from "@/lib/voice/intro";
import { takeVoice } from "@/lib/voice/prepared";
import { configuredVoice, speak } from "@/lib/voice/services";

export async function GET(_request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId: ref } = await params;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const headers = { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" };

  // His self-introduction on the welcome screen (the same line for everyone).
  if (ref === INTRO_REF) {
    const log = dbLog(db);
    try {
      return new Response(await introVoice(configuredVoice(), log), { headers });
    } catch {
      return new Response("Voice failed", { status: 502 });
    } finally {
      await log.flush();
    }
  }

  // A key: his voice was started early, while his reply was still being written.
  if (!/^\d+$/.test(ref)) {
    const early = takeVoice(user.id, ref);
    const audio = early && await early.catch(() => null);
    return audio ? new Response(audio, { headers }) : new Response("Voice failed", { status: 502 });
  }

  // A saved line (🔁 Again after a reload, past chats): make it now.
  const text = await voiceText(db, Number(ref));   // also checks the line is yours
  if (!text) return new Response("Not found", { status: 404 });
  const log = dbLog(db);
  try {
    return new Response(await speak(configuredVoice(), text, log), { headers });
  } catch {
    return new Response("Voice failed", { status: 502 });
  } finally {
    await log.flush();
  }
}
