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

## Launch

Set `MAINTENANCE_MODE=false` (or remove it) and redeploy.
