#!/usr/bin/env node
/**
 * Convert a Phantom/Solflare base58 private key export to a Solana CLI keypair file.
 * Runs locally only — paste at the prompt; nothing is logged or sent anywhere.
 */
import { createInterface } from "node:readline";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

const TARGET = process.env.LOTTERY_TEST_WALLET ?? ".keys/lottery-integration.json";
const EXPECTED =
  process.env.LOTTERY_TEST_PUBKEY ??
  "Hcm8gHTnsSENygdXihgnYUhxycVNtmtTNBLwybQiJAyh";

function keypairFromInput(raw) {
  const line = raw.trim();
  if (!line) throw new Error("empty input");

  let bytes;
  if (line.startsWith("[")) {
    const arr = JSON.parse(line);
    if (!Array.isArray(arr)) throw new Error("JSON must be a byte array");
    bytes = Uint8Array.from(arr);
  } else {
    bytes = bs58.decode(line);
  }

  if (bytes.length === 32) {
    return Keypair.fromSeed(bytes);
  }
  if (bytes.length === 64) {
    return Keypair.fromSecretKey(bytes, false);
  }
  throw new Error(
    `unexpected key length ${bytes.length} (expected 32-byte seed or 64-byte secret key)`,
  );
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(question);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    let buf = "";
    const onData = (chunk) => {
      const s = chunk.toString("utf8");
      for (const ch of s) {
        if (ch === "\r" || ch === "\n") {
          stdin.off("data", onData);
          if (stdin.isTTY) stdin.setRawMode(!!wasRaw);
          process.stdout.write("\n");
          rl.close();
          resolve(buf);
          return;
        }
        if (ch === "\u0003") process.exit(130);
        if (ch === "\u007f" || ch === "\b") {
          buf = buf.slice(0, -1);
          continue;
        }
        buf += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  console.log(
    "Paste the private key export for wallet",
    EXPECTED,
    "(base58 string, or JSON byte array).",
  );
  console.log("Input is hidden. Press Enter when done.\n");

  const raw = await promptHidden("Private key: ");
  const kp = keypairFromInput(raw);
  const pubkey = kp.publicKey.toBase58();

  if (pubkey !== EXPECTED) {
    console.error(`error: export is for ${pubkey}, expected ${EXPECTED}`);
    console.error(
      "  Wrong wallet selected in Phantom, or set LOTTERY_TEST_PUBKEY to match.",
    );
    process.exit(1);
  }

  mkdirSync(dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, JSON.stringify(Array.from(kp.secretKey)));
  chmodSync(TARGET, 0o600);

  console.log(`ok: wrote ${TARGET} (${pubkey})`);

  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const env = { ...process.env, LOTTERY_TEST_WALLET: TARGET, LOTTERY_TEST_PUBKEY: EXPECTED };
  const fin = spawnSync("bash", ["scripts/lottery-setup-test-wallet.sh", TARGET], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  if (fin.status !== 0) process.exit(fin.status ?? 1);
  console.log("\nReady: npm run lottery:test:integration");
}

main().catch((err) => {
  console.error("error:", err.message ?? err);
  process.exit(1);
});
