/**
 * Create a devnet SPL mint and mint supply to a recipient (default: INITIAL_ADMIN_WALLET).
 *
 * Usage:
 *   npm run lottery:mint-devnet-token -- --name "My Token" --symbol MYT --image ./logo.png
 *   npm run lottery:mint-devnet-token -- --name "My Token" --symbol MYT --image https://example.com/a.png
 *
 * Payer / mint authority: LOTTERY_TEST_WALLET or .keys/lottery-integration.json (needs devnet SOL).
 * Recipient: --recipient <pubkey> or INITIAL_ADMIN_WALLET from .env
 */
import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import {
  createAssociatedTokenAccountInstruction,
  createMint,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import { loadLotteryKeeperKeypair } from "../src/lib/lottery/keeper-wallet";

const MANIFEST_PATH = path.join(process.cwd(), "devnet-tokens.json");

type DevnetTokenEntry = {
  name: string;
  symbol: string;
  mint: string;
  decimals: number;
  amountUi: string;
  amountRaw: string;
  recipient: string;
  imageUrl: string;
  createdAt: string;
};

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--name" && argv[i + 1]) out.name = argv[++i];
    else if (a === "--symbol" && argv[i + 1]) out.symbol = argv[++i];
    else if (a === "--image" && argv[i + 1]) out.image = argv[++i];
    else if (a === "--recipient" && argv[i + 1]) out.recipient = argv[++i];
    else if (a === "--amount" && argv[i + 1]) out.amount = argv[++i];
    else if (a === "--decimals" && argv[i + 1]) out.decimals = argv[++i];
  }
  return out;
}

function defaultSymbol(name: string): string {
  const letters = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (letters.slice(0, 6) || "TOKEN").padEnd(3, "X").slice(0, 8);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/** Resolve image to a public URL or path stored in manifest. */
function resolveImageUrl(imageArg: string, symbol: string): string {
  if (/^https?:\/\//i.test(imageArg)) {
    return imageArg;
  }
  const src = path.resolve(imageArg);
  if (!fs.existsSync(src)) {
    throw new Error(`Image not found: ${src}`);
  }
  const ext = path.extname(src) || ".png";
  const dir = path.join(process.cwd(), "public", "devnet-tokens");
  fs.mkdirSync(dir, { recursive: true });
  const destName = `${slugify(symbol)}${ext}`;
  const dest = path.join(dir, destName);
  fs.copyFileSync(src, dest);
  return `/devnet-tokens/${destName}`;
}

function loadManifest(): DevnetTokenEntry[] {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as DevnetTokenEntry[];
  } catch {
    return [];
  }
}

function saveManifest(entries: DevnetTokenEntry[]) {
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(entries, null, 2)}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.name?.trim()) {
    console.error(
      "Usage: npm run lottery:mint-devnet-token -- --name \"Token Name\" --symbol SYM --image <path-or-url> [--recipient <pubkey>] [--amount 1000000] [--decimals 9]",
    );
    process.exit(1);
  }

  const name = args.name.trim();
  const symbol = (args.symbol ?? defaultSymbol(name)).trim().toUpperCase();
  if (!args.image?.trim()) {
    console.error("--image is required (local file path or https URL)");
    process.exit(1);
  }

  const recipientStr =
    args.recipient?.trim() || process.env.INITIAL_ADMIN_WALLET?.trim();
  if (!recipientStr) {
    console.error(
      "Set INITIAL_ADMIN_WALLET in .env or pass --recipient <admin-pubkey>",
    );
    process.exit(1);
  }

  const payer = loadLotteryKeeperKeypair();
  if (!payer) {
    console.error(
      "No payer keypair. Set LOTTERY_TEST_WALLET or add .keys/lottery-integration.json (needs devnet SOL).",
    );
    process.exit(1);
  }

  const decimals = parseInt(args.decimals ?? "9", 10);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) {
    console.error("--decimals must be 0–9");
    process.exit(1);
  }

  const amountUi = args.amount ?? "1000000";
  const amountNum = Number(amountUi);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    console.error("--amount must be a positive number (human units, not lamports)");
    process.exit(1);
  }
  const amountRaw = BigInt(
    Math.round(amountNum * 10 ** decimals),
  );

  const rpc =
    process.env.LOTTERY_DEVNET_RPC?.trim() ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
    "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");

  const recipient = new PublicKey(recipientStr);
  const imageUrl = resolveImageUrl(args.image.trim(), symbol);

  console.info(`RPC:       ${rpc}`);
  console.info(`Payer:     ${payer.publicKey.toBase58()}`);
  console.info(`Recipient: ${recipient.toBase58()}`);
  console.info(`Token:     ${name} (${symbol}), decimals=${decimals}`);
  console.info(`Mint:      ${amountUi} tokens (raw ${amountRaw})`);
  console.info(`Image:     ${imageUrl}`);

  const mint = await createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    decimals,
  );

  const ata = getAssociatedTokenAddressSync(mint, recipient);
  const ataInfo = await connection.getAccountInfo(ata);
  const tx = new Transaction();
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
  tx.add(
    createMintToInstruction(mint, ata, payer.publicKey, amountRaw),
  );
  const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
  });

  const mintInfo = await getMint(connection, mint);
  const entry: DevnetTokenEntry = {
    name,
    symbol,
    mint: mint.toBase58(),
    decimals: mintInfo.decimals,
    amountUi,
    amountRaw: amountRaw.toString(),
    recipient: recipient.toBase58(),
    imageUrl,
    createdAt: new Date().toISOString(),
  };

  const manifest = loadManifest();
  manifest.push(entry);
  saveManifest(manifest);

  console.info("");
  console.info("Created devnet SPL token:");
  console.info(`  Mint:      ${entry.mint}`);
  console.info(`  ATA:       ${ata.toBase58()}`);
  console.info(`  Tx:        ${sig}`);
  console.info(`  Manifest:  ${MANIFEST_PATH}`);
  console.info("");
  console.info("Admin SPL row (create draw / catalog):");
  console.info(`  mint: ${entry.mint}`);
  console.info(`  symbol: ${entry.symbol}`);
  console.info(`  label: ${entry.name}`);
  console.info(`  mintDecimals: ${entry.decimals}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
