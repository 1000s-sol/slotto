import "dotenv/config";

import { writeFileSync } from "fs";

import { Connection, PublicKey } from "@solana/web3.js";

import {
  readDrawFromRaw,
  readSplMintRowFromRaw,
} from "../src/lib/lottery/draw-account";
import { drawPda, globalConfigPda } from "../src/lib/lottery/pdas";

const OUT = "scripts/.inspect-out.txt";
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

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`timeout ${label} after ${ms}ms`)), ms),
    ),
  ]);
}

async function main() {
  const programId = new PublicKey(
    (process.env.NEXT_PUBLIC_SLOTTO_LOTTERY_PROGRAM_ID ?? "").trim(),
  );
  const connection = new Connection(rpcUrl(), "confirmed");
  log("RPC:", rpcUrl().replace(/api-key=[^&]+/, "api-key=***"));
  log("Program:", programId.toBase58());

  const gc = globalConfigPda(programId);
  log("global_config:", gc.toBase58());
  let nextDrawId = 13;
  try {
    const gcInfo = await withTimeout(
      connection.getAccountInfo(gc, "confirmed"),
      15000,
      "globalConfig",
    );
    if (gcInfo) {
      nextDrawId = Number(gcInfo.data.readBigUInt64LE(8 + 128));
      log("next_draw_id:", String(nextDrawId));
    } else {
      log("global_config NOT FOUND");
    }
  } catch (e) {
    log("globalConfig error:", String(e));
  }

  const empty = PublicKey.default.toBase58();
  for (let id = 0; id <= Math.min(nextDrawId, 13); id += 1) {
    const key = drawPda(programId, id);
    try {
      const info = await withTimeout(
        connection.getAccountInfo(key, "confirmed"),
        15000,
        `draw#${id}`,
      );
      if (!info?.data?.length) {
        log(`draw #${id}: none`);
        continue;
      }
      const data = Buffer.from(info.data);
      const raw = readDrawFromRaw(data);
      if (!raw) {
        log(`draw #${id}: parse failed (len=${data.length})`);
        continue;
      }
      log(
        `draw #${id} state=${raw.state} open=${raw.salesOpenTs} close=${raw.salesCloseTs} tickets=${raw.totalTickets} splCount=${raw.splCount}`,
      );
      for (let i = 0; i < raw.splCount; i += 1) {
        const row = readSplMintRowFromRaw(data, i);
        if (!row) continue;
        const m = row.mint.toBase58();
        if (m === empty) continue;
        log(
          `   - ${m} cap=${row.cap} sold=${row.sold} price=${row.pricePerTicket} dec=${row.mintDecimals} mode=${row.pricingMode}`,
        );
      }
    } catch (e) {
      log(`draw #${id} error:`, String(e));
    }
  }
  log("DONE");
}

main().catch((e) => {
  log("FATAL", String(e));
  process.exit(1);
});
