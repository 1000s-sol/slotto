import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";
import { NextResponse } from "next/server";

import {
  readProfileSessionCookie,
  setProfileSessionCookie,
} from "@/lib/profile-session";
import {
  linkWalletToProfile,
  profileHasSocial,
} from "@/lib/user-profile-db";
import {
  parseProfileWalletVerifyMessage,
  profileWalletMessageValid,
} from "@/lib/wallet-verify-message";

export const runtime = "nodejs";

function decodeBase58(s: string): Uint8Array | null {
  try {
    return bs58.decode(s);
  } catch {
    return null;
  }
}

type Body = {
  address?: string;
  message?: string;
  signature?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 });
  }

  const address = (body.address ?? "").trim();
  const message = body.message ?? "";
  const signatureB58 = body.signature ?? "";

  if (!address || !message || !signatureB58) {
    return NextResponse.json({ ok: false, reason: "missing fields" }, { status: 400 });
  }

  const parsed = parseProfileWalletVerifyMessage(message);
  if (!parsed.wallet || parsed.wallet !== address) {
    return NextResponse.json({ ok: false, reason: "address mismatch" }, { status: 400 });
  }
  if (!profileWalletMessageValid(parsed.expires)) {
    return NextResponse.json({ ok: false, reason: "message expired" }, { status: 400 });
  }
  if (!message.includes("Slotto profile wallet verification")) {
    return NextResponse.json({ ok: false, reason: "invalid message" }, { status: 400 });
  }

  const pubkey = decodeBase58(address);
  const signature = decodeBase58(signatureB58);
  if (!pubkey || pubkey.length !== 32) {
    return NextResponse.json({ ok: false, reason: "bad address" }, { status: 400 });
  }
  if (!signature || signature.length !== 64) {
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

  try {
    const profileId = await readProfileSessionCookie();
    if (!profileId) {
      return NextResponse.json(
        {
          ok: false,
          reason: "Connect Discord or X on your profile before linking a wallet.",
        },
        { status: 403 },
      );
    }
    const hasSocial = await profileHasSocial(profileId);
    if (!hasSocial) {
      return NextResponse.json(
        {
          ok: false,
          reason: "Connect Discord or X on your profile before linking a wallet.",
        },
        { status: 403 },
      );
    }
    const { profileId: finalId, merged } = await linkWalletToProfile(
      profileId,
      address,
    );
    await setProfileSessionCookie(finalId);
    return NextResponse.json({ ok: true, address, profileId: finalId, merged });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "link failed";
    return NextResponse.json({ ok: false, reason: msg }, { status: 400 });
  }
}
