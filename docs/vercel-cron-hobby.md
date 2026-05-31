# Lottery settlement cron (Vercel Hobby)

Vercel **Hobby** only allows built-in cron **once per day**, which is not enough to settle draws after `sales_close_ts`.

**Recommended:** GitHub Actions (in-repo) — see `.github/workflows/lottery-crank.yml`.

## GitHub Actions (secure, no public crank)

1. Add repo secret **`CRON_SECRET`** — same value as on Vercel (`CRON_SECRET` or `LOTTERY_CRON_SECRET`).
2. Optional repo variable **`LOTTERY_CRANK_URL`** if not using `https://www.slotto.gg/api/lottery/crank`.
3. Workflow runs every **5 minutes** (GitHub’s minimum for schedules) and on **workflow_dispatch** (manual).
4. On Vercel, keep:
   - `NEXT_PUBLIC_LOTTERY_PUBLIC_CRANK_ENABLED` **unset or `false`**
   - `LOTTERY_PUBLIC_CRANK_ENABLED` **unset or `false`**
   - `CRON_SECRET` set (API route rejects unauthenticated calls)

The workflow calls `GET /api/lottery/crank` with `Authorization: Bearer <CRON_SECRET>`. Visitors cannot trigger the keeper.

## Not recommended for production

**Public homepage crank** (`NEXT_PUBLIC_LOTTERY_PUBLIC_CRANK_ENABLED=true`) lets any visitor spend keeper SOL and influence settlement timing. It was only a fallback when no scheduler exists. Use GitHub Actions instead.

## Other options

| Option | Notes |
|--------|--------|
| **Vercel Pro** | Restore `vercel.json` with `*/2 * * * *` if you upgrade. |
| **External cron** | cron-job.org etc. — same HTTP call as GitHub Actions. |
| **Manual** | `npm run lottery:settle -- <drawId>` or `npm run lottery:keeper` locally. |

## Tomorrow’s space

The draw runs **30 days**; settlement only matters **after sales close**. GitHub cron does not need to be live for the launch stream itself. You can enable the workflow when the draw is created, or trigger **workflow_dispatch** once after close for testing.
