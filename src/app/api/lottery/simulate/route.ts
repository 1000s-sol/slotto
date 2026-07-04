import { Transaction } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { lotteryRpcErrorText } from "@/lib/lottery/user-facing-error";
import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Simulate an unsigned legacy tx on server RPC before Phantom opens (sigVerify: false). */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`lottery-sim:${ip}`, 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  let transactionB64: string;
  try {
    const body = (await request.json()) as { transaction?: string };
    transactionB64 = (body.transaction ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!transactionB64) {
    return NextResponse.json({ error: "Missing transaction" }, { status: 400 });
  }

  let raw: Buffer;
  try {
    raw = Buffer.from(transactionB64, "base64");
  } catch {
    return NextResponse.json({ error: "Invalid base64" }, { status: 400 });
  }

  try {
    const tx = Transaction.from(raw);
    const result = await withLotteryServerRpc((connection) =>
      connection.simulateTransaction(tx, {
        sigVerify: false,
        commitment: "confirmed",
      }),
    );
    const err = result.value.err;
    const logs = result.value.logs ?? [];
    if (err) {
      return NextResponse.json(
        {
          ok: false,
          error: JSON.stringify(err),
          logs: logs.slice(-12),
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, logs: logs.slice(-8) });
  } catch (e) {
    const message = lotteryRpcErrorText(e).slice(0, 500) || "simulate failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
