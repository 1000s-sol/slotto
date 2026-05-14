import { NextResponse } from "next/server";

import {
  adminSecretConfigured,
  buildChallenge,
  challengeMessage,
} from "@/lib/admin-session";

export async function GET(request: Request) {
  if (!adminSecretConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "ADMIN_DASHBOARD_SECRET not configured" },
      { status: 503 },
    );
  }
  const url = new URL(request.url);
  const address = (url.searchParams.get("address") ?? "").trim();
  if (!address) {
    return NextResponse.json({ ok: false, reason: "missing address" }, { status: 400 });
  }

  const challenge = buildChallenge();
  const message = challengeMessage(address, challenge);
  return NextResponse.json(
    {
      ok: true,
      message,
      nonce: challenge.nonce,
      exp: challenge.exp,
      sig: challenge.sig,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
