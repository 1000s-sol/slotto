import { NextResponse } from "next/server";

import {
  attachProfileSessionCookie,
  parseProfileHandoffToken,
} from "@/lib/profile-session";

export const dynamic = "force-dynamic";

function safeNext(raw: string | null, requestUrl: string): URL {
  const fallback = new URL("/profile", requestUrl);
  if (!raw) return fallback;
  try {
    const dest = raw.startsWith("/")
      ? new URL(raw, requestUrl)
      : new URL(raw);
    const host = dest.hostname.toLowerCase();
    const allowed =
      host === "slotto.gg" ||
      host === "www.slotto.gg" ||
      host === "localhost" ||
      host.endsWith(".vercel.app");
    if (!allowed) return fallback;
    if (dest.pathname.startsWith("/api/")) return fallback;
    return dest;
  } catch {
    return fallback;
  }
}

/** Sets the profile session after Discord/X OAuth, then returns to the page that started it. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const profileId = parseProfileHandoffToken(url.searchParams.get("token") ?? undefined);
  if (!profileId) {
    return NextResponse.redirect(new URL("/profile?error=oauth_failed", url));
  }

  const dest = safeNext(url.searchParams.get("next"), request.url);
  const linked = url.searchParams.get("linked");
  if (linked === "discord" || linked === "twitter") {
    dest.searchParams.set("linked", linked);
  }
  const response = NextResponse.redirect(dest);
  attachProfileSessionCookie(response, profileId, url.hostname);
  return response;
}
