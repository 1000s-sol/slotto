import { NextResponse } from "next/server";

import {
  MAINTENANCE_COOKIE,
  isValidBypassKey,
  maintenanceBypassSecret,
} from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!maintenanceBypassSecret()) {
    return NextResponse.json(
      { error: "MAINTENANCE_BYPASS_SECRET is not configured" },
      { status: 503 },
    );
  }

  const key = new URL(request.url).searchParams.get("key");
  if (!isValidBypassKey(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  const res = NextResponse.redirect(new URL("/", request.url));
  res.cookies.set(MAINTENANCE_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
