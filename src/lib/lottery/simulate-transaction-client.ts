import type { Transaction } from "@solana/web3.js";

import { BuyPreflightError } from "./preflight-buy-sol";

/** Server RPC simulate before Phantom — surfaces real on-chain errors early. */
export async function simulateTransactionClient(
  tx: Transaction,
): Promise<void> {
  const raw = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  const res = await fetch("/api/lottery/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction: Buffer.from(raw).toString("base64"),
    }),
  });
  const json = (await res.json()) as {
    ok?: boolean;
    error?: string;
    logs?: string[];
  };
  if (res.ok && json.ok) return;

  const logs = (json.logs ?? []).join("\n");
  const detail = [json.error, logs].filter(Boolean).join("\n").slice(0, 400);
  throw new BuyPreflightError(
    detail
      ? `This purchase would fail on-chain: ${detail}`
      : "This purchase would fail on-chain. Refresh and try again.",
  );
}
