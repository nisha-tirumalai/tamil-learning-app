// The address the *browser* used to reach the app.
//
// In Codespaces the phone visits https://<codespace>-3000.app.github.dev, but the
// request reaches Next.js as "localhost:3000". Redirecting to request.url would
// send the phone to localhost, which goes nowhere. The forwarding proxy puts the
// real address in the x-forwarded-* headers, so use those when present.
import type { NextRequest } from "next/server";

export function publicUrl(request: NextRequest, path: string): URL {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]
    ?? request.nextUrl.protocol.replace(":", "");
  return new URL(path, host ? `${proto}://${host}` : request.url);
}
