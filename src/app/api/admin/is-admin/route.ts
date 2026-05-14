import { NextResponse } from "next/server";

import { isActiveAdminWallet } from "@/lib/admin-session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const address = (url.searchParams.get("address") ?? "").trim();
  if (!address) {
    return NextResponse.json({ ok: false, reason: "missing address" }, { status: 400 });
  }
  const ok = await isActiveAdminWallet(address);
  return NextResponse.json(
    { ok },
    { headers: { "Cache-Control": "no-store" } },
  );
}
