// Laddu's voice for one of his lines (spec 003), as MP3. The voice reads the
// hidden Tamil-script version of the line, which never goes to the screen;
// only the audio comes back. The phone keeps the audio for 🔁 Again and
// 🐢 Slow, so those don't call the voice service again. When muted, the phone
// never asks, so no voice call is made.
import { dbLog } from "@/lib/calls";
import { voiceText } from "@/lib/chat/turn";
import { createClient } from "@/lib/supabase/server";
import { configuredVoice, speak } from "@/lib/voice/services";

export async function GET(_request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const text = await voiceText(db, Number(messageId));
  if (!text) return new Response("Not found", { status: 404 });
  const log = dbLog(db);
  try {
    const audio = await speak(configuredVoice(), text, log);
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" } });
  } catch {
    return new Response("Voice failed", { status: 502 });
  } finally {
    await log.flush();
  }
}
