/**
 * Simulate a SOL ticket buy on the configured cluster (no wallet popup, no spend).
 * Usage: npm run lottery:simulate-buy -- [drawId] [buyerPubkey]
 */
import "dotenv/config";

import { Connection, PublicKey } from "@solana/web3.js";

import { chainUnixTs, fetchDrawById, isDrawBuyable } from "../src/lib/lottery/chain";
import { lotteryProgramId } from "../src/lib/lottery/config";
import { DrawState, LAMPORTS_PER_SOL_TICKET } from "../src/lib/lottery/constants";
import {
  lotteryClusterFromRpc,
  lotteryClusterLabel,
  resolveLotteryClusterEnv,
} from "../src/lib/lottery/cluster";
import { fetchActiveSellingDraw } from "../src/lib/lottery/draws";
import {
  BuyPreflightError,
  preflightBuySolTickets,
} from "../src/lib/lottery/preflight-buy-sol";
import {
  resolveLotteryRpcUrl,
  resolvePublicSolanaRpcUrl,
} from "../src/lib/lottery/rpc-url";

const DEFAULT_BUYER = "Hcm8gHTnsSENygdXihgnYUhxycVNtmtTNBLwybQiJAyh";

function readOnlyWallet(pubkey: PublicKey) {
  return {
    publicKey: pubkey,
    signTransaction: async () => {
      throw new Error("simulate only");
    },
    signAllTransactions: async () => {
      throw new Error("simulate only");
    },
  };
}

async function main() {
  const drawIdArg = process.argv[2];
  const buyerArg = process.argv[3]?.trim() || process.env.INITIAL_ADMIN_WALLET?.trim();

  const cluster = resolveLotteryClusterEnv();
  const serverRpc = resolveLotteryRpcUrl();
  const publicRpc = resolvePublicSolanaRpcUrl();
  const programId = lotteryProgramId();
  const connection = new Connection(serverRpc, "confirmed");

  const buyer = new PublicKey(buyerArg || DEFAULT_BUYER);
  const wallet = readOnlyWallet(buyer);

  console.info("Cluster:", cluster, `(${lotteryClusterLabel(cluster)})`);
  console.info("Server RPC:", serverRpc.replace(/api-key=[^&]+/, "api-key=***"));
  console.info(
    "Browser RPC (wallet adapter):",
    publicRpc.replace(/api-key=[^&]+/, "api-key=***"),
    lotteryClusterFromRpc(publicRpc) === cluster ? "✓ matches cluster" : "✗ MISMATCH",
  );
  console.info("Program:", programId.toBase58());
  console.info("Buyer:", buyer.toBase58());

  const balance = await connection.getBalance(buyer, "confirmed");
  console.info(
    "Buyer balance:",
    (balance / 1e9).toFixed(4),
    "SOL (need",
    (LAMPORTS_PER_SOL_TICKET / 1e9).toFixed(4),
    "per ticket)",
  );

  let draw =
    drawIdArg !== undefined
      ? await fetchDrawById(connection, programId, parseInt(drawIdArg, 10))
      : await fetchActiveSellingDraw(connection, programId);

  if (!draw) {
    console.error(
      "\nNo selling draw found. Pass a draw id explicitly, or create a draw in admin first.",
    );
    process.exit(1);
  }

  const nowSec = await chainUnixTs(connection);
  console.info(
    `\nDraw #${draw.drawId}: state=${draw.state} tickets=${draw.totalTickets}`,
  );
  console.info(
    "Sales window (chain time):",
    new Date(draw.salesOpenTs * 1000).toISOString(),
    "→",
    new Date(draw.salesCloseTs * 1000).toISOString(),
  );
  console.info("Chain now:", new Date(nowSec * 1000).toISOString());
  console.info("Buyable now:", isDrawBuyable(draw, nowSec));

  if (draw.state !== DrawState.Selling) {
    console.error(
      "\nDraw is not in Selling state — simulation would fail on-chain.",
    );
    process.exit(1);
  }

  if (!isDrawBuyable(draw, nowSec)) {
    console.error("\nSales window is closed or not open yet on chain time.");
    process.exit(1);
  }

  try {
    await preflightBuySolTickets(connection, wallet, programId, draw, 1);
    console.info("\n✓ Simulation OK — SOL buy should succeed when you sign in Phantom.");
  } catch (e) {
    const msg =
      e instanceof BuyPreflightError
        ? e.message
        : e instanceof Error
          ? e.message
          : String(e);
    console.error("\n✗ Simulation failed:", msg);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
