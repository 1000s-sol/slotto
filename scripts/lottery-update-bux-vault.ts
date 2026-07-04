/**
 * Point global_config.bux_vault at the new BUX wallet (after program upgrade).
 * Usage: npm run lottery:update-bux-vault
 */
import "dotenv/config";

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";

import { LOTTERY_BUX_VAULT } from "../src/lib/lottery/recipients";
import { globalConfigPda } from "../tests/pdas";
import type { SlottoLottery } from "../target/types/slotto_lottery";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SlottoLottery as Program<SlottoLottery>;
  const authority = (provider.wallet as anchor.Wallet).payer;
  const globalConfig = globalConfigPda(program.programId);
  const bux = new PublicKey(LOTTERY_BUX_VAULT);

  const cfg = await program.account.globalConfig.fetch(globalConfig);
  if (cfg.buxVault.equals(bux)) {
    console.info("BUX vault already set to", bux.toBase58());
    return;
  }

  console.info("Updating BUX vault:", cfg.buxVault.toBase58(), "→", bux.toBase58());

  await program.methods
    .updateBuxVault(bux)
    .accounts({
      authority: authority.publicKey,
      globalConfig,
    })
    .rpc();

  console.info("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
