# SPL lottery rollout checklist

Use this after pulling `main` with the SPL catalog, admin UI, and program changes (50 mints, `add_spl_mint_to_draw`). Order matters: **database → program deploy → Vercel env → smoke test**.

Product details: [onchain-lottery-v1-spec.md](./onchain-lottery-v1-spec.md).

---

## Prerequisites (local)

- Node 20+, `npm install` in repo root
- [Anchor](https://www.anchor-lang.com/docs/installation) + Solana CLI with `cargo-build-sbf` (Agave / Solana 1.18+ toolchain)
- `.env` copied from `.env.example` with real values (never commit `.env`)
- Devnet deploy wallet: `npm run lottery:import-wallet` → `.keys/lottery-integration.json` (or set `LOTTERY_TEST_WALLET`)

Verify toolchain:

```bash
anchor --version
solana --version
cargo build-sbf --version   # must exist; if missing, reinstall Solana/Agave CLI
```

---

## 1. Neon Postgres (new tables)

Adds `LotterySplCatalogEntry` and `LotteryDrawSplMint` (see `prisma/schema.prisma`).

From your machine (Neon must be reachable):

```bash
cd /path/to/slotto.gg
npm install
npm run db:push
```

If you get **P1001 Can't reach database server**:

1. Open [Neon console](https://console.neon.tech) → your project → **Wake** if paused.
2. In **Connection details**, copy the **direct** (non-`pooler`) connection string into `.env` as `DIRECT_URL=` (keep pooled `DATABASE_URL` for the app).
3. Retry `npm run db:push`.
4. Check VPN/firewall; try another network if it still fails.

Optional: inspect rows

```bash
npm run db:studio
```

**Vercel:** Production deploy runs `prisma generate` on install; tables must already exist from the step above (or run `db push` against the same `DATABASE_URL` Vercel uses).

If `db push` fails with P1001, check Neon project is awake, IP allowlist, and `DATABASE_URL` in `.env`.

---

## 2. Anchor program (devnet)

Upgrades the on-chain program to **50 SPL mints** and **`add_spl_mint_to_draw`**. Until this runs, the app UI works but **add mint mid-draw** and **>16 mints per draw** will fail on-chain.

```bash
export PATH="$HOME/.cargo/bin:$PATH"   # if `anchor` not on PATH in npm scripts

npm run lottery:build
npm run lottery:deploy:devnet
```

Note the printed **Program id** (also):

```bash
solana-keygen pubkey target/deploy/slotto_lottery-keypair.json
```

If the program id **changed** (new keypair), update everywhere below. If you **upgraded** the same program id, only redeploy was required.

Commit any intentional id drift after `anchor keys sync` (only if your workflow keeps `declare_id!` / IDL address in git):

```bash
git diff programs/slotto_lottery/src/lib.rs idl/slotto_lottery.json src/lib/lottery/slotto_lottery.ts
```

---

## 3. Vercel environment

In **Project → Settings → Environment Variables** (Production + Preview as needed):

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Same Neon DB you ran `db:push` on |
| `NEXT_PUBLIC_SLOTTO_LOTTERY_PROGRAM_ID` | Yes | Must match deployed program (step 2) |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Yes (devnet) | e.g. `https://api.devnet.solana.com` or Helius devnet |
| `ADMIN_DASHBOARD_SECRET` | Yes | Admin login cookie signing |
| `INITIAL_ADMIN_WALLET` | Seed only | For `db:seed`; wallet must be in `AdminWallet` to use admin SPL UI |
| `LOTTERY_KEEPER_SECRET_KEY` | Yes for auto-settle | Full JSON array `[1,2,...]` from keeper keypair file |
| `BLOB_READ_WRITE_TOKEN` | If using uploads | Project images |

Optional:

- `LOTTERY_KEEPER_WALLET` — local path instead of `LOTTERY_KEEPER_SECRET_KEY`
- `CRON_SECRET` / `LOTTERY_CRON_SECRET` — only if you add a Hobby-safe cron route later (not in `vercel.json` today)

Redeploy after env changes: **Deployments → Redeploy** (or push to `main`).

Confirm GitHub → Vercel integration is approved if deploys stopped (GitHub App “permission updates”).

---

## 4. Local sanity check (optional)

```bash
npx tsc --noEmit
npm run build
npm run dev
```

---

## 5. Smoke test (devnet)

1. **Admin** → `/admin/lotteries` — sign in with an allowlisted wallet.
2. **Create draw** — set schedule, add 1–2 SPL rows (or **Reload from last draw**), publish flags / caps, submit. Confirm Postgres rows exist (`db:studio` → `LotteryDrawSplMint`).
3. **Homepage** — active draw loads; **Pay with** shows SPL mints; buy 1 ticket with SPL (wallet needs token balance + SOL for fees).
4. **Current draw SPL** (admin) — raise `display_cap` (UI only), toggle **published** / **purchases locked**.
5. **Add mint** (admin, draw still **Selling**) — only succeeds after program upgrade with `add_spl_mint_to_draw`.
6. **Settlement** — after `sales_close_ts`, homepage polling should crank (keeper). Or: `npm run lottery:settle -- <drawId>` locally with keeper wallet.

Public API (UI caps / flags without chain):

```bash
curl -s "https://<your-host>/api/lottery/draw-spl?drawId=4" | jq .
```

---

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| SPL mints missing on homepage | No rows in `LotteryDrawSplMint` for that `drawId`; re-save from admin or create draw with SPL table filled |
| `add_spl_mint` / buy SPL fails on-chain | Program not redeployed; wrong `NEXT_PUBLIC_SLOTTO_LOTTERY_PROGRAM_ID` |
| `TooManySplMints` on create | Old program (16 cap); redeploy step 2 |
| Auto-settle never runs | Set `LOTTERY_KEEPER_SECRET_KEY` on Vercel; keeper needs devnet SOL |
| Old week-long draw in UI | Superseded draw hidden when a newer draw settled; refresh after settle |
| `prisma` errors on Vercel | Run `npm run db:push` against production `DATABASE_URL` |

---

## Devnet test tokens (3 mints)

Mint SPL tokens to your admin wallet for lottery testing. Payer uses `LOTTERY_TEST_WALLET` (devnet SOL); recipient defaults to `INITIAL_ADMIN_WALLET`.

```bash
npm run lottery:mint-devnet-token -- \
  --name "Token Display Name" \
  --symbol TICKER \
  --image ./path/to/logo.png
```

Records mint addresses in `devnet-tokens.json`. Local images are copied to `public/devnet-tokens/` for hosting.

---

## Not in this rollout

- **Dynamic SPL price** ≈ 0.095 SOL per ticket — spec TODO; prices are fixed at `create_draw` / `add_spl_mint`.
- **SPL integration tests** — `npm run lottery:test:integration` (SOL path only today).
