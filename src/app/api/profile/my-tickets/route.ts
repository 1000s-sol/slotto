import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { getMyTicketRowsForWallet, hasAnyLotteryDraw } from "@/lib/lottery-my-tickets-query";

function normalizeWallet(raw: string | null): string | null {
  const t = raw?.trim();
  if (!t) return null;
  try {
    return new PublicKey(t).toBase58();
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = normalizeWallet(searchParams.get("wallet"));
  if (!wallet) {
    return NextResponse.json({ error: "Invalid or missing wallet" }, { status: 400 });
  }

  try {
    const [rows, anyDraws] = await Promise.all([getMyTicketRowsForWallet(wallet), hasAnyLotteryDraw()]);
    return NextResponse.json({ rows, anyDraws });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load tickets" }, { status: 500 });
  }
}
