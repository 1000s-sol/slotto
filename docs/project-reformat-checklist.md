# Project listing reformat checklist

Track reformatting of published listings into the fixed tiles:

1. Overview (required)  
2. Rewards / staking (optional — leave blank if none)  
3. Token (optional — leave blank if no project token)  
4. Holder utility (required)  
5. Services (optional — leave blank if the project does not serve other collections)

A listing counts as **done** when Overview and Holder utility are filled in the DB (`sectionOverview`, `sectionHolderUtility`), **and** every associated collection has been checked for Orbis + GraveMarket marketplace links (add verified URLs to `collections` when available; skip when not listed there). Leave Rewards/staking, Token, and Services blank when they do not apply so those tiles stay hidden — do not write “no token” / “no staking” filler.

## Format rules (every reformatted listing)

Full house style lives in `.cursor/rules/slotto-project-listing-reviews.mdc`. Short version:

- One continuous **paragraph** per tile (full sentences). Overview should be **comprehensive** (identity, history, collections, main benefits) — not a stub.
- **Complimentary** catalogue voice — we only list projects we like; founders should read these as fair and positive.
- **Direct** voice only — no “it appears”, “seems”, “according to the site”, etc.
- **Do not invent** tokens, LP, utilities, or partners. Do not pad with “there is no X”.
- Mention a **secondary token only if it exists**.
- Do **not** include the token mint address in the Token tile — it is already shown above the sections.
- Token tile: say what the token **does**; do not list what it cannot do.
- **Leave Rewards/staking, Token, and Services blank** when they do not apply (tiles stay hidden).
- No URLs or markdown emphasis in tile bodies unless asked.
- **Do not repeat page chrome:** no marketplace lists (buttons exist), no supply counts (stats exist above), no boilerplate “Discord and @handle as social rails” (mention Discord/X only when that *is* the utility).
- **Marketplace links (required every listing):** for each collection, probe Orbis + GraveMarket and **add missing verified links to DB** before ticking done.
  - Orbis: live only if page title is `NAME | Orbis NFT Marketplace` (bare `NFT Marketplace` = missing). Try ME/Tensor path slugs (underscore↔hyphen) and collection name slug.
  - GraveMarket: confirm via `api.deads.io/gravemarket/v1/collections/{slug}` (SPA HTML alone is inconclusive). Also try search + ME slug transforms (`moneymonsters3d` → `money-monsters-3d`).
  - Do **not** invent links; leave off when not found.

## DB commands (fast edits)

```bash
# Ensure columns exist + show progress
npx tsx scripts/set-project-sections.ts status

# Inspect one project
npx tsx scripts/set-project-sections.ts show omerta-empire-city

# Set fields from flags (quote carefully)
npx tsx scripts/set-project-sections.ts set some-slug \
  --overview "..." \
  --staking "..." \
  --token "..." \
  --holder "..." \
  --services "..."

# Or from a JSON file
npx tsx scripts/set-project-sections.ts set some-slug --json ./tmp/some-slug.json

# Seed Omerta from the approved preview copy
npx tsx scripts/set-project-sections.ts seed-omerta
```

JSON shape:

```json
{
  "overview": "...",
  "staking": "...",
  "token": "...",
  "holderUtility": "...",
  "services": "..."
}
```

Requires `DATABASE_URL` or `DIRECT_URL` in `.env`. After schema deploy, also run `npm run db:push` once on the production DB if columns are missing.

## Checklist (54 published)

Tick in this file as each listing is reformatted. Keep alphabetical by name.

- [x] Absurd Apes (`absurd-apes`)
- [x] Aevon (`aevon`)
- [x] Bored Ape Sol Club (`bored-ape-sol-club`)
- [x] Bulls on Sol Society (`bulls-on-sol-society`)
- [x] BUXDAO (`buxdao`)
- [x] Chart Breakers (`chart-breakers`)
- [x] Crouton Jones (`crouton-jones`)
- [x] Dead Bunnies (`dead-bunnies`)
- [x] DMST (`dmst`)
- [x] Eapes (`eapes`)
- [x] Enchanted Miners (`enchanted-miners`)
- [x] Energy Wabbits (`energy-wabbits`)
- [x] Famous Fox Federation (`famous-fox-federation`)
- [x] Frens Factory (`frens-factory`)
- [x] GAINZ (`gainz`)
- [x] Geeks (`geeks`)
- [x] Gensuki (`gensuki`)
- [x] GoodFellas (`goodfellas`)
- [x] Goofy Giraffes (`goofy-giraffes`)
- [x] Haxz (`haxz`)
- [x] K.B.D.S (`k-b-d-s`)
- [x] Loud Lords (`loud-lords`) — unpublished until more remint/takeover info
- [x] Lunarverse (`lunarverse`)
- [x] MAGApixel (`magapixel`)
- [x] Midevils (`midevils`)
- [x] Mnk3y Labs (`mnk3y-labs`)
- [x] Mob Collective (`mob-collective`)
- [x] Mutants On Sol Crew (`mutants-on-sol-crew`)
- [x] Okay Bears (`okay-bears`)
- [x] Omerta - Empire City (`omerta-empire-city`)
- [x] Onchain Bridges (`onchain-bridges`)
- [x] Pandarianz (`pandarianz`)
- [x] Pawpular (`pawpular`)
- [x] Pepeverse (`pepeverse`)
- [x] Puffsterz (`puffsterz`)
- [x] Shinigami (`shinigami`)
- [x] SoDead (`sodead`)
- [x] Solana Deads (`solana-deads`)
- [x] Solana Sky Pilots (`solana-sky-pilots`) — unpublished until Sky Pilot NFT markets/mint details are firmer
- [x] Solana Strays (`solana-strays`)
- [x] Solarians (`solarians`)
- [x] SolGods (`solgods`)
- [x] Stone Gods (`stone-gods`)
- [x] Stoned Sloths (`stoned-sloths`)
- [x] THC Labz (`thc-labz`)
- [x] The Fox Club (`the-fox-club`)
- [x] The Misfits Order (`the-misfits-order`)
- [x] The Rejects (`the-rejects`)
- [x] Ugly Ape Squad (`ugly-ape-squad`)
- [x] Uni-Fy (`uni-fy`) — unpublished until UNIFY mint/markets and live product surface are firmer
- [x] Villagers (`villagers`)
- [x] Wegens (`wegens`) — deleted from catalog
- [x] Xape Labz (`xape-labz`)
- [x] ZomBabieZ (`zombabiez`)
