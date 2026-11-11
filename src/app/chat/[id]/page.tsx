// A live chat with Laddu.
import { notFound } from "next/navigation";
import { Chat } from "@/components/Chat";
import { getConversation } from "@/lib/chat/turn";
import { createClient } from "@/lib/supabase/server";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const conversation = await getConversation(db, id).catch(() => null);
  if (!conversation) notFound();
  return (
    <>
      {conversation.title && <p className="situation">🎬 {conversation.title}</p>}
      <Chat conversationId={id} initial={conversation.thread} opener={conversation.started_by === "laddu"} />
    </>
  );
}
