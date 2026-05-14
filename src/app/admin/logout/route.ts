import { NextResponse } from "next/server";

import { clearAdminSessionCookie } from "@/lib/admin-session";

export async function POST(request: Request) {
  await clearAdminSessionCookie();
  return NextResponse.redirect(new URL("/", request.url));
}
