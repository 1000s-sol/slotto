import "dotenv/config";

import { Connection } from "@solana/web3.js";

import { fetchDrawById } from "../src/lib/lottery/chain";
import { lotteryProgramId } from "../src/lib/lottery/config";
import { fetchDrawPaidWithMints } from "../src/lib/lottery/draw-paid-with";
import {
  getDrawPaidWithFromDb,
  mergeDrawPaidWithIntoDb,
} from "../src/lib/lottery/draw-paid-with-db";
import { resolveLotteryRpcUrl } from "../src/lib/lottery/rpc-url";
import { fetchDrawEntrants } from "../src/lib/lottery/ticket-holders";
import { prisma } from "../src/lib/prisma";

async function main() {
  const drawId = parseInt(process.argv[2] ?? "9", 10);
  const rpc = resolveLotteryRpcUrl();
  const connection = new Connection(rpc, "confirmed");
  const programId = lotteryProgramId();

  console.log("Backfilling paid-with for draw #", drawId);

  const before = await getDrawPaidWithFromDb(drawId);
  console.log("DB wallets before:", Object.keys(before).length);

  const { paidWith, complete } = await fetchDrawPaidWithMints(
    connection,
    programId,
    drawId,
  );
  console.log(
    "Chain scan:",
    Object.keys(paidWith).length,
    "wallets, complete:",
    complete,
  );

  if (!complete) {
    console.error("Chain scan incomplete — not writing to DB");
    process.exit(1);
  }

  const draw = await fetchDrawById(connection, programId, drawId);
  if (draw) {
    const entrants = await fetchDrawEntrants(connection, programId, draw);
    const ew = new Set(entrants.map((e) => e.wallet));
    const matched = Object.keys(paidWith).filter((w) => ew.has(w)).length;
    console.log("Entrants matched:", matched, "/", entrants.length);
  }

  const inserted = await mergeDrawPaidWithIntoDb(drawId, paidWith);
  const after = await getDrawPaidWithFromDb(drawId);
  console.log("DB wallets after:", Object.keys(after).length, "(inserted", inserted, "rows)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
