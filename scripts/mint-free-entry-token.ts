/**
 * Mint the SLOTTO FREE ENTRY token on MAINNET.
 *
 *   - 9 decimals (renders as a fungible token, not an NFT collectible)
 *   - Fixed supply: 50 tokens minted to the team vault (the recycle sink)
 *   - On-chain Metaplex metadata (name + symbol + image) so wallets show it nicely
 *   - Mint authority is RETAINED by the authority wallet (revoke later if desired)
 *
 * Payer / mint authority: the lottery authority keypair (LOTTERY_KEEPER_SECRET_KEY /
 * LOTTERY_KEEPER_WALLET / LOTTERY_TEST_WALLET / .keys/lottery-integration.json) — the
 * same wallet used to create draws. Needs a little mainnet SOL (~0.01).
 *
 * Usage:
 *   npm run lottery:mint-free-entry -- --yes
 *   npm run lottery:mint-free-entry -- --yes --recipient <pubkey> --amount 50
 *
 * After it prints the mint address, set NEXT_PUBLIC_FREE_ENTRY_MINT in .env + Vercel.
 */
import "dotenv/config";

import {
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  createAssociatedTokenAccountInstruction,
  createMint,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import {
  FREE_ENTRY_DECIMALS,
  FREE_ENTRY_NAME,
  FREE_ENTRY_SYMBOL,
} from "../src/lib/lottery/free-entry";
import { loadLotteryKeeperKeypair } from "../src/lib/lottery/keeper-wallet";
import { LOTTERY_TEAM_VAULT } from "../src/lib/lottery/recipients";
import {
  resolveLotteryCluster,
  resolveLotteryRpcUrl,
} from "../src/lib/lottery/rpc-url";

const METADATA_URI = "https://slotto.gg/free-entry-token.json";

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--yes") out.yes = true;
    else if (a === "--recipient" && argv[i + 1]) out.recipient = argv[++i];
    else if (a === "--amount" && argv[i + 1]) out.amount = argv[++i];
  }
  return out;
}

function metadataPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID,
  );
  return pda;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const payer = loadLotteryKeeperKeypair();
  if (!payer) {
    console.error(
      "No authority keypair. Set LOTTERY_KEEPER_SECRET_KEY / LOTTERY_KEEPER_WALLET / LOTTERY_TEST_WALLET, or add .keys/lottery-integration.json.",
    );
    process.exit(1);
  }

  const rpc = resolveLotteryRpcUrl();
  const cluster = resolveLotteryCluster();
  const connection = new Connection(rpc, "confirmed");

  const recipient = new PublicKey(
    (args.recipient as string)?.trim() || LOTTERY_TEAM_VAULT,
  );
  const amountTokens = Number((args.amount as string) ?? "50");
  if (!Number.isInteger(amountTokens) || amountTokens <= 0) {
    console.error("--amount must be a positive integer number of whole tokens.");
    process.exit(1);
  }
  const amountRaw = BigInt(amountTokens) * BigInt(10) ** BigInt(FREE_ENTRY_DECIMALS);

  console.info("Cluster:    ", cluster);
  console.info("RPC:        ", rpc);
  console.info("Authority:  ", payer.publicKey.toBase58());
  console.info("Recipient:  ", recipient.toBase58(), "(team vault — recycle sink)");
  console.info("Token:      ", `${FREE_ENTRY_NAME} (${FREE_ENTRY_SYMBOL})`);
  console.info("Decimals:   ", FREE_ENTRY_DECIMALS);
  console.info("Supply:     ", `${amountTokens} tokens (raw ${amountRaw})`);
  console.info("Metadata:   ", METADATA_URI);

  if (cluster === "mainnet-beta" && !args.yes) {
    console.error(
      "\nThis will mint on MAINNET. Re-run with --yes to confirm.\n",
    );
    process.exit(1);
  }

  const balance = await connection.getBalance(payer.publicKey, "confirmed");
  if (balance < 5_000_000) {
    console.error(
      `Authority wallet has ${(balance / 1e9).toFixed(4)} SOL — add a little more (~0.01) for rent + fees.`,
    );
    process.exit(1);
  }

  // 1) Create the mint (authority retained on payer; no freeze authority).
  const mint = await createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    FREE_ENTRY_DECIMALS,
  );
  console.info("\nMint created:", mint.toBase58());

  // 2) Metadata + recipient ATA + mint supply in one transaction.
  const metadata = metadataPda(mint);
  const ata = getAssociatedTokenAddressSync(mint, recipient);
  const ataInfo = await connection.getAccountInfo(ata);

  const tx = new Transaction();
  tx.add(
    createCreateMetadataAccountV3Instruction(
      {
        metadata,
        mint,
        mintAuthority: payer.publicKey,
        payer: payer.publicKey,
        updateAuthority: payer.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: {
            name: FREE_ENTRY_NAME,
            symbol: FREE_ENTRY_SYMBOL,
            uri: METADATA_URI,
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null,
          },
          isMutable: true,
          collectionDetails: null,
        },
      },
    ),
  );
  if (!ataInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        ata,
        recipient,
        mint,
      ),
    );
  }
  tx.add(createMintToInstruction(mint, ata, payer.publicKey, amountRaw));

  const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
  });

  console.info("Metadata + supply tx:", sig);
  console.info("Recipient ATA:       ", ata.toBase58());
  console.info("\nDone. Next steps:");
  console.info(`  1. Set NEXT_PUBLIC_FREE_ENTRY_MINT=${mint.toBase58()} in .env + Vercel`);
  console.info("  2. Redeploy so the buy UI + create-draw pick it up");
  console.info("  3. Future draws will auto-include the free-entry option");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
