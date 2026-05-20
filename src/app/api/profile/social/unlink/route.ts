import { NextResponse } from "next/server";

import { unlinkDiscord, unlinkTwitter } from "@/lib/wallet-profile-db";
import { readProfileWalletCookie } from "@/lib/wallet-session";

export const runtime = "nodejs";

type Body = { provider?: string };

export async function POST(request: Request) {
  const wallet = await readProfileWalletCookie();
  if (!wallet) {
    return NextResponse.json({ ok: false, reason: "wallet not verified" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 });
  }

  const provider = body.provider?.trim().toLowerCase();
  if (provider === "discord") {
    await unlinkDiscord(wallet);
  } else if (provider === "twitter" || provider === "x") {
    await unlinkTwitter(wallet);
  } else {
    return NextResponse.json({ ok: false, reason: "invalid provider" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
