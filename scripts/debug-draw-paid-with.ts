import "dotenv/config";

import { Connection } from "@solana/web3.js";

import { fetchDrawById } from "../src/lib/lottery/chain";
import { lotteryProgramId } from "../src/lib/lottery/config";
import { fetchDrawPaidWithMints } from "../src/lib/lottery/draw-paid-with";
import { drawPda } from "../src/lib/lottery/pdas";
import { resolveLotteryRpcUrl } from "../src/lib/lottery/rpc-url";
import { fetchDrawEntrants } from "../src/lib/lottery/ticket-holders";

async function main() {
  const drawId = parseInt(process.argv[2] ?? "9", 10);
  const rpc = resolveLotteryRpcUrl();
  const connection = new Connection(rpc, "confirmed");
  const programId = lotteryProgramId();
  const draw = await fetchDrawById(connection, programId, drawId);
  if (!draw) {
    console.log("draw not found");
    return;
  }

  const drawPk = drawPda(programId, drawId);
  const sigs = await connection.getSignaturesForAddress(drawPk, { limit: 1000 });
  console.log("signatures (first page):", sigs.length);

  const entrants = await fetchDrawEntrants(connection, programId, draw);
  console.log("entrants:", entrants.length, "totalTickets:", draw.totalTickets);

  const paid = await fetchDrawPaidWithMints(connection, programId, drawId);
  const ew = new Set(entrants.map((e) => e.wallet));
  const pw = new Set(Object.keys(paid.paidWith));
  const matched = [...ew].filter((w) => pw.has(w));
  console.log(
    "paidWith keys:",
    pw.size,
    "matched entrants:",
    matched.length,
    "complete:",
    paid.complete,
  );
  console.log("missing:", [...ew].filter((w) => !pw.has(w)).length);
  for (const w of [...ew].filter((x) => !pw.has(x))) {
    const e = entrants.find((x) => x.wallet === w)!;
    console.log("  ", w, "tickets", e.tickets);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
