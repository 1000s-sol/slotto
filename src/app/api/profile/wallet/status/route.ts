import { NextResponse } from "next/server";

import { getWalletSocial } from "@/lib/wallet-profile-db";
import { readProfileWalletCookie } from "@/lib/wallet-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const wallet = (await readProfileWalletCookie()) ?? null;
  const queryWallet = new URL(request.url).searchParams.get("wallet")?.trim();

  if (!wallet) {
    return NextResponse.json({ verified: false, social: null });
  }

  const social =
    queryWallet && queryWallet === wallet
      ? await getWalletSocial(wallet)
      : queryWallet
        ? null
        : await getWalletSocial(wallet);

  return NextResponse.json({
    verified: true,
    wallet,
    social,
  });
}
