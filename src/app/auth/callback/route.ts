// The magic link in the email lands here with a one-time code, which we swap
// for a login session (stored in cookies), then go to the home page.
//
// The swap only works in the same browser that asked for the link: that browser
// holds a hidden "code verifier" cookie that must match the code.
import { NextResponse, type NextRequest } from "next/server";
import { publicUrl } from "@/lib/public-url";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");

  // Supabase sends ?error=…&error_description=… when the link itself was rejected
  // (e.g. already used or really expired).
  const linkError = params.get("error_description") ?? params.get("error");
  if (linkError) {
    console.error(`[auth/callback] Supabase rejected the link: ${linkError}`);
    return NextResponse.redirect(publicUrl(request, "/login?error=link"));
  }

  if (!code) {
    console.error("[auth/callback] No code in the link.");
    return NextResponse.redirect(publicUrl(request, "/login?error=link"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Most often: the link was opened in a different browser from the one that
    // asked for it, so the code verifier cookie is missing.
    console.error(`[auth/callback] Couldn't swap the code for a session: ${error.message}`);
    return NextResponse.redirect(publicUrl(request, "/login?error=link"));
  }
  return NextResponse.redirect(publicUrl(request, "/"));
}
