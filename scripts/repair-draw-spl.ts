import "dotenv/config";

import { writeFileSync } from "fs";

import { Connection, PublicKey } from "@solana/web3.js";

import {
  readDrawFromRaw,
  readSplMintRowFromRaw,
} from "../src/lib/lottery/draw-account";
import { drawPda } from "../src/lib/lottery/pdas";
import {
  FREE_ENTRY_MINT,
  FREE_ENTRY_NAME,
  FREE_ENTRY_SYMBOL,
} from "../src/lib/lottery/free-entry";
import { saveSplRowsForDraw } from "../src/lib/lottery/spl-catalog-db";
import { prisma } from "../src/lib/prisma";
import type { SplMintDraft } from "../src/lib/lottery/spl-types";

const OUT = "scripts/.repair-out.txt";
const lines: string[] = [];
const log = (...a: unknown[]) => {
  const s = a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  lines.push(s);
  writeFileSync(OUT, lines.join("\n") + "\n");
};

function rpcUrl(): string {
  const explicit = process.env.LOTTERY_RPC_URL?.trim();
  if (explicit) return explicit;
  const key = process.env.HELIUS_API_KEY?.trim();
  if (key) return `https://mainnet.helius-rpc.com/?api-key=${key}`;
  return "https://api.mainnet-beta.solana.com";
}

async function main() {
  const drawId = parseInt(process.argv[2] ?? "6", 10);
  const apply = process.argv.includes("--apply");
  const programId = new PublicKey(
    (process.env.NEXT_PUBLIC_SLOTTO_LOTTERY_PROGRAM_ID ?? "").trim(),
  );
  const connection = new Connection(rpcUrl(), "confirmed");
  log("draw:", String(drawId), "apply:", String(apply));

  const key = drawPda(programId, drawId);
  const info = await connection.getAccountInfo(key, "confirmed");
  if (!info?.data?.length) {
    log("ERROR: on-chain draw not found");
    await prisma.$disconnect();
    return;
  }
  const data = Buffer.from(info.data);
  const raw = readDrawFromRaw(data);
  if (!raw) {
    log("ERROR: parse failed");
    await prisma.$disconnect();
    return;
  }
  log(`on-chain state=${raw.state} splCount=${raw.splCount}`);

  const empty = PublicKey.default.toBase58();
  const onChain: {
    mint: string;
    cap: number;
    price: string;
    decimals: number;
    mode: number;
  }[] = [];
  for (let i = 0; i < raw.splCount; i += 1) {
    const row = readSplMintRowFromRaw(data, i);
    if (!row) continue;
    const m = row.mint.toBase58();
    if (m === empty) continue;
    onChain.push({
      mint: m,
      cap: row.cap,
      price: row.pricePerTicket.toString(),
      decimals: row.mintDecimals,
      mode: row.pricingMode,
    });
  }

  // Verified mint → display metadata (from published projects + free entry).
  const META: Record<string, { symbol: string; label: string }> = {
    AaKrMsZkuAdJL6TKZbj7X1VaH5qWioL7oDHagQZa1w59: {
      symbol: "BUXDAO",
      label: "BUXDAO",
    },
    FPTaXcvgE4Jwf5NK4tLcZAqPqHooPgFxZ8yWbEaTZ6W5: {
      symbol: "The Rejects",
      label: "The Rejects",
    },
  };

  const drafts: SplMintDraft[] = onChain.map((o) => {
    const isFree = FREE_ENTRY_MINT && o.mint === FREE_ENTRY_MINT;
    const meta = isFree
      ? { symbol: FREE_ENTRY_SYMBOL, label: FREE_ENTRY_NAME }
      : META[o.mint] ?? { symbol: o.mint.slice(0, 8), label: o.mint.slice(0, 8) };
    return {
      mint: o.mint,
      symbol: meta.symbol,
      label: meta.label,
      mintDecimals: o.decimals,
      pricingMode: o.mode === 1 ? "liquidDynamic" : "fixed",
      priceUi: "",
      pricePerTicket: o.price,
      onChainCap: o.cap,
      displayCap: o.cap,
      published: true,
      purchasesLocked: false,
      enabled: true,
    };
  });

  log("\nPlanned DB rows for draw #" + drawId + ":");
  for (const d of drafts) {
    log(
      `  - ${d.mint} sym=${d.symbol} label=${d.label} mode=${d.pricingMode} price=${d.pricePerTicket} dec=${d.mintDecimals} cap=${d.onChainCap} disp=${d.displayCap} pub=${d.published}`,
    );
  }

  if (!apply) {
    log("\nDRY RUN — re-run with --apply to write.");
    await prisma.$disconnect();
    return;
  }

  await saveSplRowsForDraw(drawId, drafts);
  log("\nAPPLIED. Saved " + drafts.length + " rows.");
  await prisma.$disconnect();
}

main().catch((e) => {
  log("FATAL", String(e));
  process.exit(1);
});
