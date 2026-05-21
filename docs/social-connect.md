# Discord & X profile linking

Users build a **profile** on `/profile` (Discord and/or X, plus optional Solana wallets).

## Flow

1. **Connect Discord** and/or **Connect X** — no wallet required. Sets a profile session cookie.
2. **Like projects** — requires profile session with at least one social connected.
3. **Link wallets** (optional) — sign a message per wallet; multiple wallets per profile.
4. **My tickets** — aggregates on-chain tickets across all linked wallets.
5. Draw tables on the homepage still list **one row per wallet**; social columns resolve wallet → profile.

## Merge behavior

- One wallet can only belong to one profile.
- If you link a wallet that already exists on another profile, profiles **merge** (socials + wallets + likes).
- If you connect Discord on profile A and later connect the same Discord while on profile B, profiles merge into the active session.

## Vercel env

```env
AUTH_SECRET=<openssl rand -hex 32>
AUTH_URL=https://slotto.gg

AUTH_DISCORD_ID=
AUTH_DISCORD_SECRET=
DISCORD_BOT_TOKEN=

AUTH_TWITTER_ID=
AUTH_TWITTER_SECRET=
```

## OAuth redirect URIs

| Provider | Redirect URI |
|----------|----------------|
| Discord | `https://<site>/api/auth/callback/discord` |
| X | `https://<site>/api/auth/callback/twitter` |

## Database

```bash
npm run db:push
```

If upgrading from `WalletProfile` (wallet-as-PK):

```bash
npm run db:migrate-profiles   # creates UserProfile tables + copies legacy data
npm run db:push               # sync schema (use DIRECT_URL in .env, not pooler)

# If db:push fails with "UserProfile_discordId_key already exists":
npm run db:fix-profile-push && npm run db:push
```

Schema: `UserProfile`, `LinkedWallet`, `ProjectLike(userProfileId)`.

## APIs

- `GET /api/profile/me` — session profile, socials, wallets
- `POST /api/profile/wallet/verify` — link wallet (creates profile if needed)
- `POST /api/profile/wallet/unlink` — remove wallet from profile
- `POST /api/profile/social/unlink` — disconnect Discord or X
