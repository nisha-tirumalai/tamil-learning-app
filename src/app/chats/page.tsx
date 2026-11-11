// Past chats, newest first: date, topic, number of messages, average score.
import { listConversations } from "@/lib/chat/turn";
import { createClient } from "@/lib/supabase/server";
import { PastChatRow } from "./PastChatRow";

export default async function PastChats() {
  const db = await createClient();
  const chats = await listConversations(db).catch(() => null);
  if (!chats) return <p className="error">Couldn&apos;t load your chats.</p>;
  return (
    <>
      <h1>Past chats</h1>
      {chats.length === 0 && <p className="muted">No chats yet. Go say hi to Laddu! 🧸</p>}
      <ul className="lesson-list">
        {chats.map((c) => <PastChatRow key={c.id} chat={c} />)}
      </ul>
    </>
  );
}
