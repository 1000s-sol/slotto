# Mainnet rollout checklist

Work through phases in order. Do **not** open public ticket sales until **Phase 2 (VRF)** is done and smoke-tested.

Product spec: [onchain-lottery-v1-spec.md](./onchain-lottery-v1-spec.md). Devnet SPL UI: [spl-rollout.md](./spl-rollout.md).

---

## Phase 0 — Decisions (before spending mainnet SOL)

- [ ] **Upgrade authority** wallet identified (cold / multisig); separate from day-to-day keeper if possible
- [ ] **Deploy wallet** funded (~**4–5 SOL** for first program deploy; see Phase 3 estimate)
- [ ] **Keeper wallet** plan (can match deployer initially; needs **0.2–0.5 SOL** ongoing per draw volume)
- [ ] **Fee recipients** in `src/lib/lottery/recipients.ts` verified as **mainnet** pubkeys you control
- [ ] Legal / compliance sign-off for operating a lottery in target jurisdictions
- [ ] Accept that **same program keypair** → same program id on mainnet as devnet (`target/deploy/slotto_lottery-keypair.json`), or generate a new keypair for a fresh mainnet-only id

---

## Phase 1 — Tooling & app config (no mainnet deploy yet)

- [x] `scripts/lottery-deploy-mainnet.sh` + `npm run lottery:deploy:mainnet`
- [x] `scripts/lottery-rpc.ts` + `npm run lottery:init` (cluster-aware RPC)
- [x] `src/lib/lottery/cluster.ts` + Solscan cluster fix
- [x] `[programs.mainnet]` in `Anchor.toml`
- [ ] Run `npm run lottery:test` and `npm run lottery:test:integration` on latest `main`
- [ ] Production Neon schema up to date (`npm run db:push` against prod `DATABASE_URL`)
- [ ] Vercel Production env documented (see table below)

### Vercel Production env

| Variable | Required | Mainnet notes |
|----------|----------|----------------|
| `DATABASE_URL` | Yes | Neon pooled URL |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Yes | Helius / mainnet-beta (not devnet) |
| `NEXT_PUBLIC_SLOTTO_LOTTERY_PROGRAM_ID` | Yes | After deploy (Phase 3) |
| `ADMIN_DASHBOARD_SECRET` | Yes | |
| `LOTTERY_KEEPER_SECRET_KEY` | Yes | Mainnet-funded keeper |
| `AUTH_URL` | Yes | `https://slotto.gg` (must match Discord/X redirect URIs; do not use `*.vercel.app`) |
| `AUTH_DISCORD_*` / `AUTH_TWITTER_*` | Yes | OAuth redirect URLs for production |
| `DISCORD_BOT_TOKEN` | Yes | |
| `BLOB_READ_WRITE_TOKEN` | If using uploads | |

---

## Phase 2 — Switchboard VRF (blocker for public launch)

Program + keeper now support **dual path**: stub (devnet) and Switchboard (production). See [switchboard-vrf.md](./switchboard-vrf.md).

- [x] Add `switchboard-on-demand` (Rust) + `@switchboard-xyz/on-demand` (TS)
- [x] `request_vrf`: optional `[randomness_account]` remaining account
- [x] `settle`: Switchboard path `[randomness, chunk, winner]` or stub `[chunk, winner]`
- [x] Keeper crank: `LOTTERY_VRF_MODE` + Switchboard commit/reveal/settle
- [ ] `npm run lottery:build` succeeds locally (verify Switchboard crate + Anchor 0.30.1)
- [ ] Devnet end-to-end test with `LOTTERY_VRF_MODE=switchboard`
- [ ] Security review / audit of randomness path
- [ ] Redeploy program (devnet then mainnet)

See spec §Randomness in [onchain-lottery-v1-spec.md](./onchain-lottery-v1-spec.md).

---

## Phase 3 — Deploy program on mainnet

Prerequisites: Phase 2 complete **or** deploy only for internal testing with **no public sales**.

```bash
# .env: LOTTERY_DEPLOY_WALLET, NEXT_PUBLIC_SOLANA_RPC_URL (mainnet), optional LOTTERY_RPC_URL
npm run lottery:build
npm run lottery:deploy:mainnet   # prompts for confirmation
```

- [ ] Deploy wallet balance ≥ **4 SOL** (script checks `LOTTERY_MAINNET_MIN_BALANCE`, default 4)
- [ ] Note printed **program id** and **upgrade authority**
- [ ] `anchor keys sync` if id changed; commit `declare_id!` + IDL if your workflow tracks them
- [ ] Set `NEXT_PUBLIC_SLOTTO_LOTTERY_PROGRAM_ID` on Vercel; redeploy app

### SOL budget (reference)

| Item | Approx SOL |
|------|------------|
| First program deploy (~405 KB `.so`) | **2.8–3.2** |
| Headroom + tx fees | **0.5–1.0** |
| `initialize` (global config PDA) | **~0.002** |
| Per `create_draw` (account rent) | **~0.02–0.06** |
| Jackpot **seed** (your choice) | **0.05+** (not burned; in prize vault) |
| Keeper per draw (close → vrf → settle) | **~0.005–0.02** |

Check exact rent before deploy:

```bash
npm run lottery:build
solana rent $(wc -c < target/deploy/slotto_lottery.so | tr -d ' ') -u mainnet-beta
```

---

## Phase 4 — Initialize & smoke test

```bash
# .env: mainnet RPC, LOTTERY_KEEPER_SECRET_KEY or deploy keypair, program id
npm run lottery:init
```

- [ ] `initialize` succeeds once (global config PDA exists)
- [ ] Admin `/admin/lotteries` — create test draw (small seed, short window)
- [ ] Buy 1 SOL ticket from mainnet wallet
- [ ] After close: keeper cranks (`LOTTERY_KEEPER_SECRET_KEY` on Vercel) or `npm run lottery:settle -- <drawId>`
- [ ] Winner paid; Solscan links show **mainnet** (no `?cluster=devnet`)
- [ ] SPL buy test with real mainnet mint (if offering SPL)

---

## Phase 5 — Go live

- [ ] Remove or disable maintenance mode
- [ ] Announce only after Phase 2 + Phase 4 pass
- [ ] Monitor keeper balance and crank errors in Vercel logs
- [ ] Document upgrade policy for users (upgradeable program)

---

## Commands quick reference

| Task | Command |
|------|---------|
| Unit tests | `npm run lottery:test` |
| Integration (local validator) | `npm run lottery:test:integration` |
| Build program | `npm run lottery:build` |
| Deploy devnet | `npm run lottery:deploy:devnet` |
| Deploy mainnet | `npm run lottery:deploy:mainnet` |
| Initialize | `npm run lottery:init` |
| Keeper (local) | `npm run lottery:keeper` |
| Settle one draw | `npm run lottery:settle -- <drawId>` |

---

## Revision log

| Date | Note |
|------|------|
| 2026-05-24 | Phase 1 tooling: mainnet deploy script, cluster-aware RPC, rollout doc |
| 2026-05-24 | Phase 2 WIP: dual-path VRF (stub + Switchboard), keeper + docs/switchboard-vrf.md |
