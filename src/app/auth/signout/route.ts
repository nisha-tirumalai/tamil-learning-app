import { NextResponse, type NextRequest } from "next/server";
import { publicUrl } from "@/lib/public-url";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(publicUrl(request, "/login"), { status: 303 });
}
