import { NextResponse } from "next/server";

import { MAINTENANCE_COOKIE } from "@/lib/maintenance";

/** Clears team bypass cookie (show maintenance again on slotto.gg). */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(MAINTENANCE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
