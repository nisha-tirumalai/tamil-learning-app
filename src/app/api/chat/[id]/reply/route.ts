// Laddu's reply, streamed to the browser as one JSON event per line
// (see ReplyEvent in src/lib/chat/turn.ts). Tamil script is filtered out on
// the server before anything is sent.
import { ERROR_TEXT } from "@/lib/chat/config";
import { anthropicModel, ModelNotConfigured } from "@/lib/chat/model";
import { replyStream, type ReplyEvent } from "@/lib/chat/turn";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const { data: profile } = await db.from("profiles").select("display_name").eq("id", user.id).single();

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (e: ReplyEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        for await (const event of replyStream(db, anthropicModel(), id, profile?.display_name ?? null)) send(event);
      } catch (e) {
        console.error("reply failed:", (e as Error).message);
        send({ t: "error", message: e instanceof ModelNotConfigured ? e.message : ERROR_TEXT });
      }
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
