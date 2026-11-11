// I send a message (spec 002): it's saved, then Laddu's reply and the score
// are worked out at the same time and streamed back as they arrive, one JSON
// event per line (TurnEvent in src/lib/chat/turn.ts).
import { anthropicModel } from "@/lib/chat/model";
import { ndjsonResponse } from "@/lib/chat/stream";
import { sendTurn } from "@/lib/chat/turn";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const { text } = (await request.json().catch(() => ({}))) as { text?: unknown };
  if (typeof text !== "string") return new Response("Missing text", { status: 400 });
  const { data: profile } = await db.from("profiles").select("display_name").eq("id", user.id).single();
  return ndjsonResponse(() => sendTurn(db, anthropicModel(), { conversationId: id, text, displayName: profile?.display_name ?? null }));
}
