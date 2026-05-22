/**
 * One-shot global config: team + BUX + setup vaults (devnet/mainnet via .env RPC).
 * Usage: npm run lottery:init-devnet
 */
import "dotenv/config";

import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";

import { lotteryProgramId } from "../src/lib/lottery/config";
import {
  keypairToAnchorWallet,
  loadLotteryKeeperKeypair,
} from "../src/lib/lottery/keeper-wallet";
import { globalConfigPda } from "../src/lib/lottery/pdas";
import { createLotteryProgram } from "../src/lib/lottery/program";
import {
  LOTTERY_BUX_VAULT,
  LOTTERY_SETUP_VAULT,
  LOTTERY_TEAM_VAULT,
} from "../src/lib/lottery/recipients";

async function main() {
  const payer = loadLotteryKeeperKeypair();
  if (!payer) {
    console.error(
      "No keypair. Set LOTTERY_TEST_WALLET or add .keys/lottery-integration.json",
    );
    process.exit(1);
  }

  const rpc =
    process.env.LOTTERY_DEVNET_RPC?.trim() ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
    "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");
  const programId = lotteryProgramId();
  const globalConfig = globalConfigPda(programId);

  const existing = await connection.getAccountInfo(globalConfig);
  if (existing) {
    console.error(
      `Global config already exists at ${globalConfig.toBase58()} (len ${existing.data.length}).`,
    );
    console.error("Use a fresh program id or a cluster that has not been initialized.");
    process.exit(1);
  }

  const team = new PublicKey(LOTTERY_TEAM_VAULT);
  const bux = new PublicKey(LOTTERY_BUX_VAULT);
  const setup = new PublicKey(LOTTERY_SETUP_VAULT);

  const program = createLotteryProgram(connection, keypairToAnchorWallet(payer));

  console.info("Program id:", programId.toBase58());
  console.info("Authority:", payer.publicKey.toBase58());
  console.info("Team vault:", team.toBase58());
  console.info("BUX vault:", bux.toBase58());
  console.info("Setup vault:", setup.toBase58());

  const sig = await program.methods
    .initialize(team, bux, setup)
    .accounts({
      authority: payer.publicKey,
      globalConfig,
    })
    .rpc();

  const cfg = await program.account.globalConfig.fetch(globalConfig);
  console.info("Initialized. tx:", sig);
  console.info("next_draw_id:", cfg.nextDrawId.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
