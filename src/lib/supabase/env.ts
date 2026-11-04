// Reads the Supabase settings from .env.local, with a clear message if missing.
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase isn't configured. Copy .env.example to .env.local and fill it in (docs/SUPABASE_SETUP.md, step 6), then restart `npm run dev`.",
    );
  }
  return { url, key };
}
