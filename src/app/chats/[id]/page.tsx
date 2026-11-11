// An old conversation, read-only (v1), with its correction cards.
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chat } from "@/components/Chat";
import { getConversation } from "@/lib/chat/turn";
import { createClient } from "@/lib/supabase/server";

export default async function PastChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const conversation = await getConversation(db, id).catch(() => null);
  if (!conversation) notFound();
  return (
    <>
      <p><Link href="/chats">‹ Past chats</Link></p>
      <p className="situation">
        {conversation.title ? `🎬 ${conversation.title} · ` : ""}{new Date(conversation.created_at).toLocaleDateString()}
      </p>
      <Chat conversationId={id} initial={conversation.thread} opener={false} readOnly />
    </>
  );
}
