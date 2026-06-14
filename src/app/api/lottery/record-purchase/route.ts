import { NextResponse } from "next/server";

import { verifyLotteryBuySignature } from "@/lib/discord-ticket-bot/verify-buy-tx";
import { lotteryProgramId } from "@/lib/lottery/config";
import { recordLotteryTicketPurchase } from "@/lib/lottery/draw-paid-with-db";
import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Persist which token a wallet paid with after a confirmed on-chain buy. */
export async function POST(request: Request) {
  const limit = rateLimit(`record-purchase:${clientIp(request)}`, 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let body: {
    signature?: string;
    wallet?: string;
    drawId?: number;
    count?: number;
    payWith?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const signature = (body.signature ?? "").trim();
  const wallet = (body.wallet ?? "").trim();
  const drawId = body.drawId;
  const count = body.count;
  const payWith = (body.payWith ?? "SOL").trim();

  if (!signature || signature.length < 32 || !wallet) {
    return NextResponse.json({ error: "Invalid signature or wallet" }, { status: 400 });
  }
  if (!Number.isInteger(drawId) || drawId! < 0) {
    return NextResponse.json({ error: "Invalid drawId" }, { status: 400 });
  }
  if (!Number.isInteger(count) || count! < 1) {
    return NextResponse.json({ error: "Invalid count" }, { status: 400 });
  }

  try {
    const verified = await withLotteryServerRpc((connection) =>
      verifyLotteryBuySignature(
        connection,
        signature,
        lotteryProgramId(),
        wallet,
      ),
    );
    if (!verified) {
      return NextResponse.json({ error: "Buy not verified" }, { status: 400 });
    }

    const recorded = await recordLotteryTicketPurchase({
      signature,
      wallet,
      drawNumber: drawId!,
      count: count!,
      payWith,
    });
    return NextResponse.json({ ok: true, recorded });
  } catch (e) {
    const message = e instanceof Error ? e.message : "record failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
