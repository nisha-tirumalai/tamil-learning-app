// Supabase client for server code (pages, server actions, route handlers).
// It reads and refreshes the login session from cookies, so every query runs
// as the signed-in user and row-level security applies.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Pages can't set cookies; the middleware refreshes the session instead.
        }
      },
    },
  });
}
