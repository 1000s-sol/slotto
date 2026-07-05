import { NextResponse } from "next/server";

import { pollSignatureConfirmation } from "@/lib/lottery/confirm-signature-poll";
import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";
import { lotteryRpcErrorText } from "@/lib/lottery/user-facing-error";

export const dynamic = "force-dynamic";
/** Per-request poll budget; client retries until its own deadline. */
export const maxDuration = 60;

/** Poll signature status via server RPC (Helius, with public fallback). */
export async function POST(request: Request) {
  let signature: string;
  let maxWaitMs = 8_000;
  try {
    const body = (await request.json()) as {
      signature?: string;
      maxWaitMs?: number;
    };
    signature = (body.signature ?? "").trim();
    if (typeof body.maxWaitMs === "number" && Number.isFinite(body.maxWaitMs)) {
      maxWaitMs = Math.min(Math.max(Math.floor(body.maxWaitMs), 2_000), 55_000);
    }
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!signature || signature.length < 32) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const result = await withLotteryServerRpc((connection) =>
      pollSignatureConfirmation(connection, signature, maxWaitMs),
    );
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "confirm failed";
    return NextResponse.json({ error: lotteryRpcErrorText(e) || message }, { status: 500 });
  }
}
