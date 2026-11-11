"use client";
// One past chat, with Delete and a "Delete this chat?" confirm step.
import Link from "next/link";
import { useState, useTransition } from "react";
import { remove } from "@/app/chat/actions";
import type { ChatSummary } from "@/lib/chat/turn";

export function PastChatRow({ chat }: { chat: ChatSummary }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <li className="past-chat">
      <Link href={`/chats/${chat.id}`}>
        <span>
          <span className="topic">{chat.topic}</span>
          <span className="muted small">
            {new Date(chat.date).toLocaleDateString()} · {chat.messages} message{chat.messages === 1 ? "" : "s"}
          </span>
        </span>
        {chat.average !== null && <span className="score">⭐ {chat.average}</span>}
      </Link>
      {confirming ? (
        <span className="row confirm">
          Delete this chat?
          <button className="danger-button" disabled={pending}
            onClick={() => startTransition(async () => { await remove(chat.id); })}>
            {pending ? "Deleting…" : "Delete"}
          </button>
          <button className="secondary" onClick={() => setConfirming(false)}>Cancel</button>
        </span>
      ) : (
        <button className="link-button danger" onClick={() => setConfirming(true)}>Delete</button>
      )}
    </li>
  );
}
