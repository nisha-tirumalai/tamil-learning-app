"use server";
// "This looks wrong" flags. These run on the server as the signed-in user, so
// row-level security makes sure people only ever touch their own flags.
import { revalidatePath } from "next/cache";
import { findCard } from "@/lib/lessons";
import { createClient } from "@/lib/supabase/server";

export type FlagResult = { ok: true } | { ok: false; error: string };

export async function flagItem(itemId: string, note: string, source: "card" | "chat" = "card"): Promise<FlagResult> {
  // Take the English/Tanglish snapshot from our own data, not from the browser.
  const card = findCard(itemId);
  if (!card) return { ok: false, error: "Couldn't find that item." };
  const supabase = await createClient();
  const { error } = await supabase.from("flags").insert({
    item_id: card.id,
    english: card.english,
    tanglish: card.tanglish,
    note: note.trim().slice(0, 1000) || null,
    source,
  });
  if (error) return { ok: false, error: "Couldn't save. Are you still signed in?" };
  revalidatePath("/flags");
  return { ok: true };
}

export async function setResolved(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("flags")
    .update({ resolved: formData.get("resolved") === "true" })
    .eq("id", Number(formData.get("id")));
  revalidatePath("/flags");
}

export async function deleteFlag(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("flags").delete().eq("id", Number(formData.get("id")));
  revalidatePath("/flags");
}
