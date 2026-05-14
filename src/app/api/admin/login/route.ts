import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";
import { NextResponse } from "next/server";

import {
  adminSecretConfigured,
  buildAdminToken,
  isActiveAdminWallet,
  parseChallengeFromMessage,
  setAdminSessionCookie,
  verifyChallenge,
} from "@/lib/admin-session";

type Body = {
  address?: string;
  message?: string;
  signature?: string;
  exp?: number;
  sig?: string;
};

function decodeBase58(s: string): Uint8Array | null {
  try {
    return bs58.decode(s);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!adminSecretConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "ADMIN_DASHBOARD_SECRET not configured" },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 });
  }

  const address = (body.address ?? "").trim();
  const message = body.message ?? "";
  const signatureB58 = body.signature ?? "";
  const challengeExp = Number(body.exp ?? 0);
  const challengeSig = (body.sig ?? "").trim();

  if (!address || !message || !signatureB58 || !challengeSig) {
    return NextResponse.json({ ok: false, reason: "missing fields" }, { status: 400 });
  }

  const parsed = parseChallengeFromMessage(message);
  if (!parsed.nonce || !parsed.address) {
    return NextResponse.json({ ok: false, reason: "invalid message" }, { status: 400 });
  }
  if (parsed.address !== address) {
    return NextResponse.json({ ok: false, reason: "address mismatch" }, { status: 400 });
  }
  if (!verifyChallenge(parsed.nonce, challengeExp, challengeSig)) {
    return NextResponse.json({ ok: false, reason: "challenge expired or tampered" }, { status: 400 });
  }

  const pubkey = decodeBase58(address);
  const signature = decodeBase58(signatureB58);
  if (!pubkey || pubkey.length !== 32) {
    return NextResponse.json({ ok: false, reason: "bad address" }, { status: 400 });
  }
  if (!signature || signature.length !== 64) {
    return NextResponse.json({ ok: false, reason: "bad signature" }, { status: 400 });
  }

  const messageBytes = new TextEncoder().encode(message);
  let verified = false;
  try {
    verified = ed25519.verify(signature, messageBytes, pubkey);
  } catch {
    verified = false;
  }
  if (!verified) {
    return NextResponse.json({ ok: false, reason: "signature invalid" }, { status: 401 });
  }

  if (!(await isActiveAdminWallet(address))) {
    return NextResponse.json({ ok: false, reason: "not an admin wallet" }, { status: 403 });
  }

  const token = buildAdminToken(address);
  await setAdminSessionCookie(token);
  return NextResponse.json({ ok: true });
}
