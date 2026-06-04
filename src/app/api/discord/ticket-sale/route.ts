import { NextResponse } from "next/server";

import { discordTicketBotConfigured } from "@/lib/discord-ticket-bot/config";
import {
  normalizePayWith,
  notifyDiscordTicketSale,
  type TicketSaleNotifyInput,
} from "@/lib/discord-ticket-bot/post-ticket-sale";
import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";

export const dynamic = "force-dynamic";

/** After a confirmed on-chain buy, fan out an embed to all registered Discord servers. */
export async function POST(request: Request) {
  if (!discordTicketBotConfigured()) {
    return NextResponse.json({ ok: true, posted: 0, disabled: true });
  }

  let body: TicketSaleNotifyInput;
  try {
    body = (await request.json()) as TicketSaleNotifyInput;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const signature = (body.signature ?? "").trim();
  const wallet = (body.wallet ?? "").trim();
  if (!signature || signature.length < 32 || !wallet) {
    return NextResponse.json({ error: "Invalid signature or wallet" }, { status: 400 });
  }
  if (!Number.isInteger(body.drawId) || body.drawId < 0) {
    return NextResponse.json({ error: "Invalid drawId" }, { status: 400 });
  }
  if (!Number.isInteger(body.count) || body.count < 1) {
    return NextResponse.json({ error: "Invalid count" }, { status: 400 });
  }

  const input: TicketSaleNotifyInput = {
    signature,
    wallet,
    drawId: body.drawId,
    count: body.count,
    payWith: normalizePayWith((body.payWith ?? "SOL").trim()),
    tokenSymbol: (body.tokenSymbol ?? "").trim() || "SOL",
    tokenName: (body.tokenName ?? "").trim() || "SOL",
    tokenImageUrl: body.tokenImageUrl?.trim() || null,
  };

  try {
    const result = await withLotteryServerRpc(async (connection) => {
      const deadline = Date.now() + 45_000;
      while (Date.now() < deadline) {
        const status = await connection.getSignatureStatus(signature, {
          searchTransactionHistory: true,
        });
        const v = status.value;
        if (v?.err) {
          throw new Error("Transaction failed on-chain");
        }
        if (
          v &&
          (v.confirmationStatus === "confirmed" ||
            v.confirmationStatus === "finalized")
        ) {
          break;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      return notifyDiscordTicketSale(connection, input);
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "notify failed";
    console.warn("[discord ticket-sale]", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
