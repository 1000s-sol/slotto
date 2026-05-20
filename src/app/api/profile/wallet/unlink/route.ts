import { NextResponse } from "next/server";

import { readProfileSessionCookie } from "@/lib/profile-session";
import { unlinkWalletFromProfile } from "@/lib/user-profile-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const profileId = await readProfileSessionCookie();
  if (!profileId) {
    return NextResponse.json({ ok: false, reason: "not_signed_in" }, { status: 401 });
  }

  let body: { wallet?: string };
  try {
    body = (await request.json()) as { wallet?: string };
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 });
  }

  const wallet = body.wallet?.trim();
  if (!wallet) {
    return NextResponse.json({ ok: false, reason: "missing wallet" }, { status: 400 });
  }

  await unlinkWalletFromProfile(profileId, wallet);
  return NextResponse.json({ ok: true });
}
