# Maintenance mode (slotto.gg)

Shows a blurred homepage with the V2 “coming soon” image on **production domains only** when enabled.

## Vercel (Production)

```env
MAINTENANCE_MODE=true
MAINTENANCE_BYPASS_SECRET=<openssl rand -hex 32>
```

Optional:

```env
MAINTENANCE_HOSTS=slotto.gg,www.slotto.gg
```

Redeploy after setting env vars.

## Public visitors

- `https://slotto.gg` → blurred site + overlay; other paths redirect to `/`.
- `https://<project>.vercel.app` → **full app** (no maintenance), for day-to-day testing.

## Team bypass (on slotto.gg)

Open once (bookmark):

```text
https://slotto.gg/api/maintenance/unlock?key=YOUR_MAINTENANCE_BYPASS_SECRET
```

Sets a 30-day cookie; full site including `/admin` works.

Clear bypass:

```bash
curl -X POST https://slotto.gg/api/maintenance/lock
```

## Image

`public/maintenance/slotto-v2-coming-soon.png`

## Link previews (Discord, X, iMessage)

Root layout sets Open Graph / Twitter to `public/brand/slotto-tickets.png` with the live product title and description (on-site overlay still uses `public/maintenance/slotto-v2-coming-soon.png`).

To swap the embed card image, replace that file or drop a new PNG at the same path and redeploy. Recommended size: square, at least 1200×1200 px. Favicon is separate: `src/app/icon.png` (do not change via layout metadata).

Optional: `NEXT_PUBLIC_SITE_URL=https://slotto.gg` on Vercel (defaults to slotto.gg).

Official draw tweets use `https://slotto.gg` by default (`LOTTERY_ANNOUNCE_SITE_URL` to override). Preview `*.vercel.app` URLs in `NEXT_PUBLIC_SITE_URL` do not affect tweet links.

After deploy, platforms cache previews — use [Twitter Card Validator](https://cards-dev.twitter.com/validator) or Discord’s embed debugger to refresh.

## Launch

Set `MAINTENANCE_MODE=false` (or remove it) and redeploy.
