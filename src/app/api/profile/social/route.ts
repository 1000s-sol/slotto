import { NextResponse } from "next/server";

import { getSocialByWallets } from "@/lib/user-profile-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("wallets") ?? "";
  const wallets = raw
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
  if (wallets.length === 0) {
    return NextResponse.json({ profiles: {} });
  }
  const profiles = await getSocialByWallets(wallets);
  return NextResponse.json({ profiles });
}
