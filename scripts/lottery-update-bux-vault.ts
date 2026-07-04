/**
 * Point global_config.bux_vault at the new BUX wallet (after program upgrade).
 * Usage: npm run lottery:update-bux-vault
 */
import "dotenv/config";

import { Connection, PublicKey } from "@solana/web3.js";

import { lotteryProgramId } from "../src/lib/lottery/config";
import {
  keypairToAnchorWallet,
  loadLotteryKeeperKeypair,
} from "../src/lib/lottery/keeper-wallet";
import { globalConfigPda } from "../src/lib/lottery/pdas";
import { createLotteryProgram } from "../src/lib/lottery/program";
import { LOTTERY_BUX_VAULT } from "../src/lib/lottery/recipients";
import {
  resolveLotteryCluster,
  resolveLotteryRpcUrl,
} from "../src/lib/lottery/rpc-url";

async function main() {
  const payer = loadLotteryKeeperKeypair();
  if (!payer) {
    console.error(
      "No keypair. Set LOTTERY_KEEPER_SECRET_KEY, LOTTERY_KEEPER_WALLET, or LOTTERY_TEST_WALLET.",
    );
    process.exit(1);
  }

  const rpc = resolveLotteryRpcUrl();
  const cluster = resolveLotteryCluster();
  const connection = new Connection(rpc, "confirmed");
  const programId = lotteryProgramId();
  const globalConfig = globalConfigPda(programId);
  const bux = new PublicKey(LOTTERY_BUX_VAULT);

  const program = createLotteryProgram(connection, keypairToAnchorWallet(payer));

  console.info("Cluster:", cluster);
  console.info("RPC:", rpc);
  console.info("Program id:", programId.toBase58());
  console.info("Authority:", payer.publicKey.toBase58());

  const cfg = await program.account.globalConfig.fetch(globalConfig);
  if (cfg.buxVault.equals(bux)) {
    console.info("BUX vault already set to", bux.toBase58());
    return;
  }

  console.info("Updating BUX vault:", cfg.buxVault.toBase58(), "→", bux.toBase58());

  const sig = await program.methods
    .updateBuxVault(bux)
    .accounts({
      authority: payer.publicKey,
      globalConfig,
    })
    .rpc();

  console.info("Done. tx:", sig);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
