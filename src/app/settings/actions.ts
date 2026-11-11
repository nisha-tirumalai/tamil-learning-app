"use server";
// Saving your avatar (spec 003). Runs as the signed-in user; row-level
// security means it can only ever change your own profile.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { afterChoosing, isAvatar } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/server";

export async function chooseAvatar(form: FormData) {
  const avatar = form.get("avatar");
  const next = afterChoosing(form.get("next"));
  if (!isAvatar(avatar)) redirect(next);
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await db.from("profiles").update({ avatar }).eq("id", user.id);
  if (error) console.error("couldn't save avatar:", error.message);
  revalidatePath("/", "layout");   // every screen redraws with the new avatar
  redirect(next);
}
