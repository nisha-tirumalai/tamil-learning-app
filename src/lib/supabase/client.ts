// Supabase client for code running in the browser (used by the login page).
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Written out in full so Next.js can inline these public values at build time.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
