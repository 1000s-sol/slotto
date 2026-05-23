#!/usr/bin/env node
/** Writes `idl/slotto_lottery.json` (Anchor 0.30 spec) without `anchor idl build`. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair } from "@solana/web3.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/** Must match `target/deploy/slotto_lottery-keypair.json` after `anchor build`. */
function resolveProgramId() {
  if (process.env.SLOTTO_LOTTERY_PROGRAM_ID) {
    return process.env.SLOTTO_LOTTERY_PROGRAM_ID;
  }
  const keypairPath = path.join(root, "target/deploy/slotto_lottery-keypair.json");
  if (fs.existsSync(keypairPath)) {
    const secret = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf8")));
    return Keypair.fromSecretKey(secret).publicKey.toBase58();
  }
  return "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFTE24";
}

const PROGRAM_ID = resolveProgramId();

function disc(preimage) {
  return [...crypto.createHash("sha256").update(preimage).digest().slice(0, 8)];
}

const ix = (name, accounts, args) => ({
  name,
  discriminator: disc(`global:${name}`),
  accounts,
  args,
});

const acc = (name, opts = {}) => ({ name, ...opts });
const arg = (name, type) => ({ name, type });

const errors = [
  "Unauthorized",
  "InvalidSchedule",
  "TooManySplMints",
  "SplMintAlreadyInDraw",
  "UnexpectedRemainingAccounts",
  "InvalidSplCap",
  "InvalidSplPrice",
  "DrawIdOverflow",
  "WrongDrawState",
  "OutsideSalesWindow",
  "InvalidTicketCount",
  "ArithmeticOverflow",
  "InvalidTeamVault",
  "InvalidBuxVault",
  "InvalidSetupVault",
  "InvalidChunkAccounts",
  "InvalidChunkAccount",
  "TicketSlotOccupied",
  "MintNotInDraw",
  "SplCapExceeded",
  "SplMintDecimalsMismatch",
  "InvalidDrawStateForCloseSales",
  "SalesPeriodNotEnded",
  "InvalidDrawStateForRefund",
  "RefundDrawHasTickets",
  "InvalidSeedRefund",
  "InvalidDrawStateForVrf",
  "VrfNeedsTickets",
  "VrfAlreadyRequested",
  "InvalidDrawStateForSettle",
  "VrfNotStubMode",
  "SettleAccountsWrongLen",
  "EmptyTicketOwner",
  "WinnerMismatch",
  "InvalidDrawStateForWithdrawSpl",
].map((name, i) => ({ code: 6000 + i, name, msg: name }));

const idl = {
  address: PROGRAM_ID,
  metadata: {
    name: "slotto_lottery",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Slotto on-chain lottery (checked-in IDL; regenerate via scripts/generate-idl.mjs)",
  },
  instructions: [
    ix("initialize", [
      acc("authority", { writable: true, signer: true }),
      acc("global_config", { writable: true }),
      acc("system_program", { address: "11111111111111111111111111111111" }),
    ], [
      arg("team_vault", "pubkey"),
      arg("bux_vault", "pubkey"),
      arg("setup_vault", "pubkey"),
    ]),
    ix("create_draw", [
      acc("authority", { writable: true, signer: true }),
      acc("global_config", { writable: true }),
      acc("draw", { writable: true }),
      acc("prize_vault", { writable: true }),
      acc("system_program", { address: "11111111111111111111111111111111" }),
    ], [
      arg("sales_open_ts", "i64"),
      arg("sales_close_ts", "i64"),
      arg("seed_refund", "pubkey"),
      arg("seed_lamports", "u64"),
      arg("spl_rows", { vec: { defined: { name: "splMintArg" } } }),
    ]),
    ix("add_spl_mint_to_draw", [
      acc("authority", { writable: true, signer: true }),
      acc("global_config"),
      acc("draw", { writable: true }),
    ], [arg("spl_row", { defined: { name: "splMintArg" } })]),
    ix("buy_sol_tickets", [
      acc("buyer", { writable: true, signer: true }),
      acc("draw", { writable: true }),
      acc("prize_vault", { writable: true }),
      acc("global_config"),
      acc("team_vault", { writable: true }),
      acc("bux_vault", { writable: true }),
      acc("setup_vault", { writable: true }),
      acc("system_program", { address: "11111111111111111111111111111111" }),
      acc("rent", { address: "SysvarRent111111111111111111111111111111111" }),
      acc("clock", { address: "SysvarC1ock11111111111111111111111111111111" }),
    ], [arg("count", "u32")]),
    ix("buy_spl_tickets", [
      acc("buyer", { writable: true, signer: true }),
      acc("draw", { writable: true }),
      acc("global_config"),
      acc("mint"),
      acc("team_vault"),
      acc("buyer_token", { writable: true }),
      acc("team_token", { writable: true }),
      acc("setup_vault", { writable: true }),
      acc("token_program", { address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }),
      acc("associated_token_program", {
        address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
      }),
      acc("system_program", { address: "11111111111111111111111111111111" }),
      acc("rent", { address: "SysvarRent111111111111111111111111111111111" }),
      acc("clock", { address: "SysvarC1ock11111111111111111111111111111111" }),
    ], [arg("count", "u32")]),
    ix("close_sales", [
      acc("draw", { writable: true }),
      acc("clock", { address: "SysvarC1ock11111111111111111111111111111111" }),
    ], []),
    ix("refund_empty_draw", [
      acc("draw", { writable: true }),
      acc("prize_vault", { writable: true }),
      acc("seed_refund", { writable: true }),
      acc("system_program", { address: "11111111111111111111111111111111" }),
      acc("rent", { address: "SysvarRent111111111111111111111111111111111" }),
    ], []),
    ix("request_vrf", [acc("draw", { writable: true })], []),
    ix("settle", [
      acc("draw", { writable: true }),
      acc("prize_vault", { writable: true }),
      acc("clock", { address: "SysvarC1ock11111111111111111111111111111111" }),
      acc("rent", { address: "SysvarRent111111111111111111111111111111111" }),
      acc("system_program", { address: "11111111111111111111111111111111" }),
    ], []),
    ix("withdraw_spl", [
      acc("authority", { writable: true, signer: true }),
      acc("global_config"),
      acc("draw"),
      acc("mint"),
      acc("spl_vault_authority"),
      acc("treasury_token", { writable: true }),
      acc("destination_token", { writable: true }),
      acc("token_program", { address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }),
      acc("associated_token_program", {
        address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
      }),
      acc("system_program", { address: "11111111111111111111111111111111" }),
      acc("rent", { address: "SysvarRent111111111111111111111111111111111" }),
    ], []),
  ],
  accounts: [
    { name: "GlobalConfig", discriminator: disc("account:GlobalConfig") },
    { name: "Draw", discriminator: disc("account:Draw") },
    { name: "TicketChunk", discriminator: disc("account:TicketChunk") },
    { name: "PrizeVault", discriminator: disc("account:PrizeVault") },
  ],
  types: [
    {
      name: "splMintArg",
      type: {
        kind: "struct",
        fields: [
          { name: "mint", type: "pubkey" },
          { name: "price_per_ticket", type: "u64" },
          { name: "mint_decimals", type: "u8" },
          { name: "cap", type: "u32" },
        ],
      },
    },
    {
      name: "splMintRow",
      type: {
        kind: "struct",
        fields: [
          { name: "mint", type: "pubkey" },
          { name: "price_per_ticket", type: "u64" },
          { name: "mint_decimals", type: "u8" },
          // `#[repr(C)]` aligns `cap` / `sold` to 4 bytes (row size = 56).
          { name: "_padding0", type: { array: ["u8", 3] } },
          { name: "cap", type: "u32" },
          { name: "sold", type: "u32" },
          { name: "_padding1", type: { array: ["u8", 4] } },
        ],
      },
    },
    {
      name: "Draw",
      type: {
        kind: "struct",
        fields: [
          { name: "draw_id", type: "u64" },
          { name: "bump", type: "u8" },
          { name: "prize_vault_bump", type: "u8" },
          { name: "_padding0", type: { array: ["u8", 6] } },
          { name: "sales_open_ts", type: "i64" },
          { name: "sales_close_ts", type: "i64" },
          { name: "state", type: "u8" },
          { name: "_padding1", type: { array: ["u8", 3] } },
          { name: "total_tickets", type: "u32" },
          { name: "seed_refund", type: "pubkey" },
          { name: "spl_count", type: "u8" },
          { name: "_padding2", type: { array: ["u8", 7] } },
          {
            name: "spl_mint_rows",
            type: { array: [{ defined: { name: "splMintRow" } }, 50] },
          },
          { name: "vrf_request", type: "pubkey" },
          { name: "winning_ticket_id", type: "u32" },
          { name: "winner", type: "pubkey" },
          { name: "spl_auth_bump", type: "u8" },
        ],
      },
    },
    {
      name: "GlobalConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "team_vault", type: "pubkey" },
          { name: "bux_vault", type: "pubkey" },
          { name: "setup_vault", type: "pubkey" },
          { name: "authority", type: "pubkey" },
          { name: "next_draw_id", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "TicketChunk",
      type: {
        kind: "struct",
        fields: [
          { name: "owners", type: { array: ["pubkey", 256] } },
        ],
      },
    },
    {
      name: "PrizeVault",
      type: {
        kind: "struct",
        fields: [],
      },
    },
  ],
  errors,
};

const out = path.join(root, "idl", "slotto_lottery.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(idl, null, 2) + "\n");
console.log("wrote", out);
