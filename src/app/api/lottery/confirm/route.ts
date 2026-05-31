import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { resolveLotteryRpcUrl } from "@/lib/lottery/rpc-url";

export const dynamic = "force-dynamic";

/** Poll signature status via server RPC (Helius). */
export async function POST(request: Request) {
  let signature: string;
  try {
    const body = (await request.json()) as { signature?: string };
    signature = (body.signature ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!signature || signature.length < 32) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const connection = new Connection(resolveLotteryRpcUrl(), "confirmed");
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const status = await connection.getSignatureStatus(signature, {
        searchTransactionHistory: true,
      });
      const value = status.value;
      if (value) {
        if (value.err) {
          return NextResponse.json({
            confirmed: false,
            error: JSON.stringify(value.err),
          });
        }
        const level = value.confirmationStatus;
        if (level === "confirmed" || level === "finalized") {
          return NextResponse.json({ confirmed: true, error: null });
        }
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return NextResponse.json({
      confirmed: false,
      error: "Confirmation timed out",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "confirm failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
