# Settlement on Vercel Hobby (no frequent built-in cron)

Vercel **Hobby** only allows cron jobs **once per day**. A `*/2 * * * *` entry in `vercel.json` will fail deploy or never run often enough for lottery settlement.

Pick **one** approach:

## A — Public homepage crank (simplest for the space)

Vercel env:

```
NEXT_PUBLIC_LOTTERY_PUBLIC_CRANK_ENABLED=true
LOTTERY_PUBLIC_CRANK_ENABLED=true
```

Visitors on the site trigger throttled keeper settlement (4s cooldown per draw). Fine when you expect traffic during the draw.

## B — External cron (keeps public crank off)

Use [cron-job.org](https://cron-job.org), GitHub Actions, or similar to `GET` every 2–5 minutes:

```
https://www.slotto.gg/api/lottery/crank
Authorization: Bearer <CRON_SECRET>
```

Leave `NEXT_PUBLIC_LOTTERY_PUBLIC_CRANK_ENABLED` unset or `false`.

## C — Vercel Pro

Pro allows per-minute `vercel.json` crons. Restore:

```json
{
  "crons": [{ "path": "/api/lottery/crank", "schedule": "*/2 * * * *" }]
}
```

## D — Manual / local keeper during testing

```bash
npm run lottery:keeper
# or
npm run lottery:settle -- <drawId>
```
