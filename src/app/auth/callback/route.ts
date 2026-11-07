// The magic link in the email lands here with a one-time code, which we swap
// for a login session (stored in cookies), then go to the home page.
import { NextResponse, type NextRequest } from "next/server";
import { publicUrl } from "@/lib/public-url";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(publicUrl(request, "/"));
  }
  return NextResponse.redirect(publicUrl(request, "/login?error=link"));
}
