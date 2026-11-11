import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { AvatarProvider } from "@/components/AvatarContext";
import { isAvatar } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tamil speaking practice",
  description: "Practice spoken Tamil a few minutes a day.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("avatar").eq("id", user.id).maybeSingle()
    : { data: null };
  const avatar = isAvatar(profile?.avatar) ? profile.avatar : "girl";
  return (
    // suppressHydrationWarning: browsers with built-in assistants or extensions add
    // attributes to <html>/<body> before React loads, which triggers a harmless
    // "attributes didn't match" warning. This only ignores those two tags.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {user && (
          <header className="top">
            <nav>
              <Link href="/">🧸 Laddu</Link>
              <Link href="/chats">Past chats</Link>
              <Link href="/lessons">Lessons</Link>
              <Link href="/flags">Flags</Link>
              <Link href="/settings">Settings</Link>
            </nav>
            <form action="/auth/signout" method="post">
              <button className="link-button">Sign out</button>
            </form>
          </header>
        )}
        <main><AvatarProvider avatar={avatar}>{children}</AvatarProvider></main>
      </body>
    </html>
  );
}
