import fs from "node:fs";

import { Keypair } from "@solana/web3.js";

function keypairFromJsonBytes(raw: number[]): Keypair | null {
  if (!Array.isArray(raw) || raw.length < 64) return null;
  try {
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  } catch {
    return null;
  }
}

/** Keypair that pays keeper tx fees (`close_sales` → `request_vrf` → `settle`). */
export function loadLotteryKeeperKeypair(): Keypair | null {
  const inline = process.env.LOTTERY_KEEPER_SECRET_KEY?.trim();
  if (inline) {
    try {
      const parsed = JSON.parse(inline) as number[];
      const kp = keypairFromJsonBytes(parsed);
      if (kp) return kp;
    } catch {
      /* fall through to file */
    }
  }

  const path =
    process.env.LOTTERY_KEEPER_WALLET?.trim() ||
    process.env.LOTTERY_TEST_WALLET?.trim() ||
    ".keys/lottery-integration.json";
  try {
    const raw = JSON.parse(fs.readFileSync(path, "utf8")) as number[];
    return keypairFromJsonBytes(raw);
  } catch {
    return null;
  }
}
