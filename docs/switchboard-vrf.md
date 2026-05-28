# Switchboard VRF integration

The lottery program supports two settlement paths:

| Mode | `request_vrf` | `settle` remaining accounts | Use |
|------|----------------|----------------------------|-----|
| **stub** | No extra accounts | `[ticket_chunk, winner]` | Devnet / local only |
| **switchboard** | `[randomness_account]` | `[randomness, ticket_chunk, winner]` | Mainnet production |

Set mode via env:

```bash
LOTTERY_VRF_MODE=stub          # force stub
LOTTERY_VRF_MODE=switchboard   # force Switchboard
# unset: devnet → stub, mainnet RPC → switchboard
```

## Keeper flow (Switchboard)

1. **Create** randomness account (`createDrawRandomnessAccount`) — one per draw.
2. **Commit + request** in one transaction: Switchboard `commitIx` + program `request_vrf` with randomness account as remaining account.
3. **Reveal** after oracle window: Switchboard `revealIx`.
4. **Settle** with randomness + winning ticket chunk + winner wallet.

The homepage / Vercel crank (`runTriggerLotteryCrank`) runs this automatically when `LOTTERY_VRF_MODE=switchboard` and `LOTTERY_KEEPER_SECRET_KEY` is set.

## Queues

| Cluster | Queue |
|---------|--------|
| Mainnet | `A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w` |
| Devnet | `EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7` |

Defined in `src/lib/lottery/switchboard-config.ts`.

## On-chain parsing

The Anchor program does **not** depend on the `switchboard-on-demand` Rust crate (it pulled Anchor 1.x and broke `cargo-build-sbf` on Solana toolchain 1.84). Randomness accounts are parsed in `programs/slotto_lottery/src/switchboard_randomness.rs` (layout aligned with Switchboard SDK **0.10.x**). The keeper still uses `@switchboard-xyz/on-demand` for commit/reveal transactions.

## After program change

```bash
npm run lottery:build
npm run lottery:deploy:devnet   # test Switchboard on devnet first
LOTTERY_VRF_MODE=switchboard npm run lottery:test:integration  # when tests updated
```

Regenerate client IDL if your workflow commits it:

```bash
anchor idl build -o idl/slotto_lottery.json
# sync src/lib/lottery/slotto_lottery.ts as needed
```

## Resume failed crank

If the draw is already `VrfRequested`, the keeper reads the randomness pubkey from **`draw.vrf_request`** on-chain (no env needed). To override:

```bash
LOTTERY_RANDOMNESS_ACCOUNT=<pubkey> LOTTERY_VRF_MODE=switchboard npm run lottery:settle -- <drawId>
```

## References

- [Switchboard randomness tutorial](https://docs.switchboard.xyz/docs-by-chain/solana-svm/randomness/randomness-tutorial)
- On-chain spec: [onchain-lottery-v1-spec.md](./onchain-lottery-v1-spec.md) §Randomness
