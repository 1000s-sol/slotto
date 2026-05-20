# Discord & X profile linking

Users link social accounts to their Solana wallet on **Profile** (`/profile`).

## Flow

1. Connect wallet (Phantom, etc.).
2. **Verify wallet** — sign a short message (proves ownership, sets HTTP-only cookie).
3. **Connect Discord** or **Connect X** — OAuth; account is stored on `WalletProfile` for that wallet.
4. Linked handles appear on draw entrant tables and winner cards.

## Vercel env (Production)

```env
AUTH_SECRET=<openssl rand -hex 32>
AUTH_URL=https://slotto.gg

AUTH_DISCORD_ID=
AUTH_DISCORD_SECRET=

AUTH_TWITTER_ID=
AUTH_TWITTER_SECRET=
```

`AUTH_SECRET` can match `ADMIN_DASHBOARD_SECRET` in dev only; use a dedicated secret in production.

## OAuth redirect URIs

Register these in each developer portal:

| Provider | Redirect URI |
|----------|----------------|
| Discord | `https://slotto.gg/api/auth/callback/discord` |
| X (Twitter) | `https://slotto.gg/api/auth/callback/twitter` |

For local dev, add `http://localhost:3000/api/auth/callback/discord` (and twitter) and set `AUTH_URL=http://localhost:3000`.

## Discord Developer Portal

1. [discord.com/developers](https://discord.com/developers/applications) → New Application.
2. OAuth2 → Redirects (URI above).
3. Scopes: `identify` (default for Auth.js Discord provider).

## X Developer Portal

1. [developer.x.com](https://developer.x.com) → Project + App.
2. User authentication → OAuth 2.0 → enable.
3. Callback URL (above). Type of App: Web App.
4. Scopes: at minimum read user (Auth.js Twitter provider defaults).

## Database

```bash
npm run db:push
```

Creates `WalletProfile` table.

## Maintenance mode

`/api/auth/*` and `/api/profile/*` stay reachable during maintenance so OAuth callbacks work. Use the [maintenance bypass](maintenance-mode.md) to open `/profile` on `slotto.gg` while testing.

## Unlink

Profile UI **Disconnect**, or `POST /api/profile/social/unlink` with body `{ "provider": "discord" | "twitter" }` (requires verified wallet cookie).
