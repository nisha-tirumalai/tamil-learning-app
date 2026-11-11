// Settings (spec 003): change your avatar.
import { AvatarPicker } from "@/components/AvatarPicker";
import { isAvatar } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/server";

export default async function Settings() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  const { data: profile } = await db.from("profiles").select("avatar").eq("id", user?.id ?? "").maybeSingle();
  const current = isAvatar(profile?.avatar) ? profile.avatar : null;
  return (
    <div>
      <h1>Settings</h1>
      <h2>Your avatar</h2>
      <p className="muted">Tap one to change it.</p>
      <AvatarPicker current={current} next="/settings" />
    </div>
  );
}
