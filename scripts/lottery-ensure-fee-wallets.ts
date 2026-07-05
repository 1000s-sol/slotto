/**
 * One-time mainnet prep: fee wallets must exist before SOL ticket buys.
 * Sends 0.001 SOL to any missing team/BUX/setup/partner recipient.
 *
 * Usage: npm run lottery:ensure-fee-wallets
 */
import "dotenv/config";

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import { loadLotteryKeeperKeypair } from "../src/lib/lottery/keeper-wallet";
import {
  LOTTERY_BUX_VAULT,
  LOTTERY_PARTNER_VAULT_1,
  LOTTERY_PARTNER_VAULT_2,
  LOTTERY_SETUP_VAULT,
  LOTTERY_TEAM_VAULT,
} from "../src/lib/lottery/recipients";
import { resolveLotteryRpcUrl } from "../src/lib/lottery/rpc-url";

const FUND_LAMPORTS = 1_000_000;

const WALLETS: { label: string; address: string }[] = [
  { label: "Team vault", address: LOTTERY_TEAM_VAULT },
  { label: "BUX vault", address: LOTTERY_BUX_VAULT },
  { label: "Setup vault", address: LOTTERY_SETUP_VAULT },
  { label: "Partner vault 1", address: LOTTERY_PARTNER_VAULT_1 },
  { label: "Partner vault 2", address: LOTTERY_PARTNER_VAULT_2 },
];

async function main() {
  const payer = loadLotteryKeeperKeypair();
  if (!payer) {
    console.error(
      "No payer keypair. Set LOTTERY_KEEPER_SECRET_KEY or LOTTERY_DEPLOY_WALLET.",
    );
    process.exit(1);
  }

  const connection = new Connection(resolveLotteryRpcUrl(), "confirmed");
  console.info("Payer:", payer.publicKey.toBase58());
  console.info("RPC:", resolveLotteryRpcUrl().replace(/api-key=[^&]+/, "api-key=***"));

  const balance = await connection.getBalance(payer.publicKey, "confirmed");
  console.info("Payer balance:", (balance / 1e9).toFixed(4), "SOL");

  let funded = 0;
  for (const { label, address } of WALLETS) {
    const pk = new PublicKey(address);
    const info = await connection.getAccountInfo(pk, "confirmed");
    if (info) {
      console.info(`✓ ${label} exists (${(info.lamports / 1e9).toFixed(6)} SOL)`);
      continue;
    }

    console.info(`→ Funding ${label} ${address} …`);
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: pk,
        lamports: FUND_LAMPORTS,
      }),
    );
    const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
      commitment: "confirmed",
    });
    console.info(`  confirmed: ${sig}`);
    funded += 1;
  }

  if (funded === 0) {
    console.info("\nAll fee wallets already exist on-chain.");
  } else {
    console.info(`\nFunded ${funded} wallet(s). SOL buys should work now.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
