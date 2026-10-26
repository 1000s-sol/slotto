import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";
import { NextResponse } from "next/server";

import { readProfileSessionCookie } from "@/lib/profile-session";
import {
  getAccountClusterByWallet,
  getProfileIdByWallet,
  getProfilePublic,
  unlinkWalletFromProfile,
} from "@/lib/user-profile-db";
import {
  parseWalletUnlinkMessage,
  profileWalletMessageValid,
} from "@/lib/wallet-verify-message";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  wallet?: string;
  signer?: string;
  message?: string;
  signature?: string;
};

function decodeBase58(s: string): Uint8Array | null {
  try {
    return bs58.decode(s);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 });
  }

  const wallet = body.wallet?.trim() ?? "";
  if (!wallet) {
    return NextResponse.json({ ok: false, reason: "missing wallet" }, { status: 400 });
  }

  const profileId = await readProfileSessionCookie();
  if (profileId) {
    const mine = await getProfilePublic(profileId);
    if (mine?.wallets.includes(wallet)) {
      await unlinkWalletFromProfile(profileId, wallet);
      return NextResponse.json({ ok: true });
    }
  }

  const signer = body.signer?.trim() ?? "";
  const message = body.message ?? "";
  const signatureB58 = body.signature ?? "";
  if (!signer || !message || !signatureB58) {
    return NextResponse.json({ ok: false, reason: "not_signed_in" }, { status: 401 });
  }
  if (!message.includes("Slotto unlink linked wallet")) {
    return NextResponse.json({ ok: false, reason: "invalid message" }, { status: 400 });
  }

  const parsed = parseWalletUnlinkMessage(message);
  if (parsed.signer !== signer || parsed.remove !== wallet) {
    return NextResponse.json({ ok: false, reason: "address mismatch" }, { status: 400 });
  }
  if (!profileWalletMessageValid(parsed.expires)) {
    return NextResponse.json({ ok: false, reason: "message expired" }, { status: 400 });
  }

  const pubkey = decodeBase58(signer);
  const signature = decodeBase58(signatureB58);
  if (!pubkey || pubkey.length !== 32 || !signature || signature.length !== 64) {
    return NextResponse.json({ ok: false, reason: "bad signature" }, { status: 400 });
  }

  let verified = false;
  try {
    verified = ed25519.verify(signature, new TextEncoder().encode(message), pubkey);
  } catch {
    verified = false;
  }
  if (!verified) {
    return NextResponse.json({ ok: false, reason: "signature invalid" }, { status: 401 });
  }

  const cluster = await getAccountClusterByWallet(signer);
  if (!cluster || !cluster.wallets.includes(wallet)) {
    return NextResponse.json({ ok: false, reason: "wallet not on this account" }, { status: 403 });
  }

  const profileIdForSigner = await getProfileIdByWallet(signer);
  if (!profileIdForSigner) {
    return NextResponse.json({ ok: false, reason: "wallet not linked" }, { status: 404 });
  }

  await unlinkWalletFromProfile(profileIdForSigner, wallet);
  return NextResponse.json({ ok: true });
}
