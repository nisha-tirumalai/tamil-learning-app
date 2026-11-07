// Reads the Supabase settings (Codespaces secrets, or .env.local elsewhere), with a clear message if missing.
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase isn't configured. Add the NEXT_PUBLIC_SUPABASE_* Codespaces secrets (docs/SUPABASE_SETUP.md, Part F), reload the codespace, then restart `npm run dev`.",
    );
  }
  return { url, key };
}
