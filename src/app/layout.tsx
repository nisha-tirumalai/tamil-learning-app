import type { Metadata, Viewport } from "next";
import Link from "next/link";
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
  return (
    <html lang="en">
      <body>
        {user && (
          <header className="top">
            <nav>
              <Link href="/">Lessons</Link>
              <Link href="/flags">My flags</Link>
            </nav>
            <form action="/auth/signout" method="post">
              <button className="link-button">Sign out</button>
            </form>
          </header>
        )}
        <main>{children}</main>
      </body>
    </html>
  );
}
