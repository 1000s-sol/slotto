import { NextResponse, type NextRequest } from "next/server";

import { handlers } from "@/auth";
import {
  attachProfileSessionCookie,
  parseProfileHandoffToken,
} from "@/lib/profile-session";

/** Set the profile session on the OAuth redirect itself, before any apex → www hop. */
async function withHandoffSession(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<Response>,
) {
  const response = await handler(request);
  const location = response.headers.get("location");
  if (!location) return response;

  let profileId: string | null = null;
  try {
    const dest = new URL(location, request.url);
    if (dest.pathname !== "/api/profile/session/establish") return response;
    profileId = parseProfileHandoffToken(dest.searchParams.get("token") ?? undefined);
  } catch {
    return response;
  }
  if (!profileId) return response;

  const next = new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
  attachProfileSessionCookie(next, profileId, new URL(request.url).hostname);
  return next;
}

export function GET(request: NextRequest) {
  return withHandoffSession(request, handlers.GET);
}

export function POST(request: NextRequest) {
  return withHandoffSession(request, handlers.POST);
}
