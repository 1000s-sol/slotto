# Lottery settlement cron (Vercel Hobby)

Vercel **Hobby** only allows built-in cron **once per day**, which is not enough to settle draws after `sales_close_ts`.

## Primary: homepage timer → server keeper

When the countdown hits **sales close**, any open `slotto.gg` tab runs **`triggerLotteryCrank`** every ~6s (faster during `VrfRequested`). No wallet popups; throttled per draw on the server.

**Required on Vercel:**

| Variable | Purpose |
|----------|---------|
| `LOTTERY_KEEPER_SECRET_KEY` | JSON array of keeper keypair — pays `close_sales` / Switchboard / `settle` |
| `HELIUS_API_KEY` or safe `LOTTERY_RPC_URL` | Server RPC |

Keeper wallet needs **~0.1 SOL** on mainnet (Switchboard randomness rent).

Optional kill switch: `LOTTERY_UI_CRANK_ENABLED=false` (falls back to cron-only).

## Backup: GitHub Actions

See `.github/workflows/lottery-crank.yml`.

1. Add repo secret **`CRON_SECRET`** — same value as on Vercel (`CRON_SECRET` or `LOTTERY_CRON_SECRET`).
2. Optional repo variable **`LOTTERY_CRANK_URL`** if not using `https://www.slotto.gg/api/lottery/crank`.
3. Runs every **5 minutes** and on **workflow_dispatch** (manual). Each run cranks **twice** (45s apart) for Switchboard VRF.

The workflow calls `GET /api/lottery/crank` with `Authorization: Bearer <CRON_SECRET>`.

## Manual fallback

| Command | When |
|---------|------|
| `npm run lottery:settle -- <drawId>` | Emergency local settle |
| GitHub **workflow_dispatch** on Lottery crank | Cron missed / no visitors on site |

## Deprecated env

`NEXT_PUBLIC_LOTTERY_PUBLIC_CRANK_ENABLED` — no longer required; UI crank is on by default unless `LOTTERY_UI_CRANK_ENABLED=false`.
