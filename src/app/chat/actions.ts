"use server";
// What the chat screen asks the server to do. Each runs as the signed-in user
// (row-level security applies) and calls the real model on the server only.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { anthropicModel, ModelNotConfigured } from "@/lib/chat/model";
import {
  type CardResult, deleteConversation, flagMessage, rescore, sendMessage, setMeaning, startConversation,
} from "@/lib/chat/turn";
import { createClient } from "@/lib/supabase/server";
import { ERROR_TEXT } from "@/lib/chat/config";

async function withModel(run: (model: ReturnType<typeof anthropicModel>) => Promise<CardResult>): Promise<CardResult> {
  try {
    return await run(anthropicModel());
  } catch (e) {
    console.error("chat action failed:", (e as Error).message);
    return { ok: false, reason: "error", error: e instanceof ModelNotConfigured ? e.message : ERROR_TEXT };
  }
}

export async function start(startedBy: "me" | "laddu") {
  const db = await createClient();
  const { id } = await startConversation(db, startedBy);
  redirect(`/chat/${id}`);
}

export async function send(conversationId: string, text: string, retryOf: number | null = null) {
  const db = await createClient();
  return withModel((model) => sendMessage(db, model, { conversationId, text, retryOf }));
}

export async function notWhatIMeant(messageId: number, meant: string) {
  const db = await createClient();
  return withModel((model) => setMeaning(db, model, messageId, meant));
}

export async function tryScoringAgain(messageId: number) {
  const db = await createClient();
  return withModel((model) => rescore(db, model, messageId));
}

export async function flag(messageId: number, note: string) {
  const db = await createClient();
  const ok = await flagMessage(db, messageId, note);
  if (ok) revalidatePath("/flags");
  return ok;
}

export async function remove(conversationId: string) {
  const db = await createClient();
  const ok = await deleteConversation(db, conversationId);
  revalidatePath("/chats");
  return ok;
}
