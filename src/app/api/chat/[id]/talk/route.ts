// I hold 🎤 and talk (spec 003). The phone sends the recording here (never
// straight to a hearing service with a key). We check it, hear it, turn it
// into Tanglish, then stream back the same events as typing: "heard" (what
// Laddu heard), then his reply and my score. The audio is not stored.
import { dbLog } from "@/lib/calls";
import { anthropicModel } from "@/lib/chat/model";
import { ndjsonResponse } from "@/lib/chat/stream";
import { withEarlyVoice } from "@/lib/voice/prepared";
import { talkTurn } from "@/lib/chat/turn";
import { createClient } from "@/lib/supabase/server";
import { VOICE_CONFIG } from "@/lib/voice/config";
import { configuredHearing } from "@/lib/voice/services";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  // Refuse anything far too big before reading it.
  if (Number(request.headers.get("content-length") ?? 0) > VOICE_CONFIG.recording.maxBytes + 100_000) {
    return new Response("Recording too big", { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob)) return new Response("Missing audio", { status: 400 });
  const ms = Number(form?.get("ms"));
  const peak = Number(form?.get("peak"));
  const { data: profile } = await db.from("profiles").select("display_name").eq("id", user.id).single();
  const log = dbLog(db);
  const voice = form?.get("voice") === "1";
  return ndjsonResponse(() => withEarlyVoice(talkTurn(
    db, anthropicModel(log), configuredHearing(),
    { conversationId: id, recording: { audio, ms }, peak, displayName: profile?.display_name ?? null },
    log,
  ), db, voice, log), log.flush);
}
