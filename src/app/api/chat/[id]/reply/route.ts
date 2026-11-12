// Laddu's reply on its own: his opener ("Laddu starts"), or "tap to try again"
// after a reply failed. Streamed as one JSON event per line (ReplyEvent in
// src/lib/chat/turn.ts). Tamil script is filtered out on the server.
import { dbLog } from "@/lib/calls";
import { anthropicModel } from "@/lib/chat/model";
import { ndjsonResponse } from "@/lib/chat/stream";
import { withEarlyVoice } from "@/lib/voice/prepared";
import { replyStream } from "@/lib/chat/turn";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const { data: profile } = await db.from("profiles").select("display_name").eq("id", user.id).single();
  const log = dbLog(db);
  const { voice } = (await request.json().catch(() => ({}))) as { voice?: unknown };
  return ndjsonResponse(() => withEarlyVoice(
    replyStream(db, anthropicModel(log), id, profile?.display_name ?? null), db, voice === true, log,
  ), log.flush);
}
