import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { resolveLotteryRpcUrl } from "@/lib/lottery/rpc-url";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Broadcast a wallet-signed legacy transaction via server RPC (Helius). */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`lottery-send:${ip}`, 30, 60_000);
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

  if (raw.length < 64 || raw.length > 1232) {
    return NextResponse.json({ error: "Invalid transaction size" }, { status: 400 });
  }

  try {
    const connection = new Connection(resolveLotteryRpcUrl(), "confirmed");
    const signature = await connection.sendRawTransaction(raw, {
      skipPreflight: false,
      maxRetries: 3,
    });
    return NextResponse.json({ signature });
  } catch (e) {
    const message = e instanceof Error ? e.message : "send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
