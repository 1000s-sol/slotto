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

## Checklist (101 published)

Tick in this file as each listing is reformatted. Keep alphabetical by name.

- [x] Absurd Apes (`absurd-apes`)
- [x] ABC (`abc`)
- [x] Aevon (`aevon`)
- [x] Alpha Gardeners (`alpha-gardeners`)
- [x] Anomaly (`anomaly`)
- [x] B & H Club (`b-h-club`) — includes Degens X
- [x] Big Cats (`big-cats`)
- [x] Bored Ape Sol Club (`bored-ape-sol-club`) — includes XElementia
- [x] Bulls on Sol Society (`bulls-on-sol-society`)
- [x] BUXDAO (`buxdao`)
- [x] Chart Breakers (`chart-breakers`)
- [x] Claynosaurz (`claynosaurz`)
- [x] Crouton Jones (`crouton-jones`)
- [x] Critters Cult (`critters-cult`)
- [x] Coral Tribe (`coral-tribe`)
- [x] Cyber Frogs (`cyber-frogs`)
- [x] D1srupt0rs (`d1srupt0rs`)
- [x] Dead Bunnies (`dead-bunnies`)
- [x] Decentric (`decentric`)
- [x] DeGods (`degods`) — includes y00ts
- [x] DMST (`dmst`)
- [x] DKV (`dkv`)
- [x] Doge Capital (`doge-capital`)
- [x] Donk (`donk`)
- [x] Eapes (`eapes`)
- [x] Enchanted Miners (`enchanted-miners`)
- [x] Energy Wabbits (`energy-wabbits`)
- [x] Fuddy Dogs (`fuddy-dogs`)
- [x] Famous Fox Federation (`famous-fox-federation`)
- [x] Frens Factory (`frens-factory`)
- [x] Gearhead Coin (`gearhead-coin`) — includes Rusty Rigs
- [x] Giraffe Tower (`giraffe-tower`)
- [x] GOTM Labz (`gotm-labz`) — was GAINZ; includes GAINZ
- [x] Galactic Geckos (`galactic-geckos`)
- [x] Geeks (`geeks`)
- [x] Gensuki (`gensuki`)
- [x] GoodFellas (`goodfellas`)
- [x] Goofy Giraffes (`goofy-giraffes`)
- [x] Haxz (`haxz`)
- [x] K.B.D.S (`k-b-d-s`)
- [x] Kups by Raposa (`kups-by-raposa`)
- [x] Liminals (`liminals`)
- [x] LLama (`llpic`)
- [x] Loud Lords (`loud-lords`) — unpublished until more remint/takeover info
- [x] Lunarverse (`lunarverse`)
- [x] Mad Lads (`mad-lads`)
- [x] MAGApixel (`magapixel`)
- [x] Midevils (`midevils`)
- [x] Mindfolk (`mindfolk`) — includes Mindlings
- [x] Meerkat Millionaires (`meerkat`)
- [x] Micros (`micros`) — includes Solnautz
- [x] Mnk3y Labs (`mnk3y-labs`)
- [x] Mob Collective (`mob-collective`)
- [x] Mutants On Sol Crew (`mutants-on-sol-crew`)
- [x] NPP (`npp`)
- [x] Okay Bears (`okay-bears`)
- [x] Omerta - Empire City (`omerta-empire-city`)
- [x] Onchain Bridges (`onchain-bridges`)
- [x] Owltopia (`owltopia`)
- [x] Pandarianz (`pandarianz`)
- [x] Pawpular (`pawpular`)
- [x] Pepeverse (`pepeverse`)
- [x] Pixel by Pixel (`pixel-by-pixel`) — includes Candies, Morbies, Drippies
- [x] Pickles (`pickles`)
- [x] Planet Kaiju (`planet-kaiju`) — includes The Hated
- [x] Portals (`portals`)
- [x] Primates (`primates`)
- [x] Primals (`primals`)
- [x] Puffsterz (`puffsterz`)
- [x] Pythenians (`pythenians`)
- [x] Rafflors (`rafflors`)
- [x] Rogues (`rogues`)
- [x] Sensei (`sensei`)
- [x] Shaolin Saga (`shaolin-saga`)
- [x] Shinigami (`shinigami`)
- [x] Smyths (`smyths`)
- [x] SoDead (`sodead`)
- [x] SOL Decoder (`sol-decoder`)
- [x] Solana Deads (`solana-deads`)
- [x] Solana Monkey Business (`solana-monkey-business`)
- [x] Solana Sky Pilots (`solana-sky-pilots`) — unpublished until Sky Pilot NFT markets/mint details are firmer
- [x] Solana Strays (`solana-strays`)
- [x] Solarians (`solarians`)
- [x] SolGods (`solgods`)
- [x] Stone Gods (`stone-gods`)
- [x] Stoned Ape Crew (`stoned-apes`) — includes Nuked Apes
- [x] Stoned Sloths (`stoned-sloths`)
- [x] Taiyo Robotics (`taiyo-robotics`) — includes Infants, Oil, Pilots
- [x] Tensorians (`tensorians`)
- [x] THC Labz (`thc-labz`)
- [x] The Fox Club (`the-fox-club`) — includes Cyber Foxes
- [x] The Misfits Order (`the-misfits-order`)
- [x] The Northlanders (`the-northlanders`)
- [x] The Rejects (`the-rejects`)
- [x] Ugly Ape Squad (`ugly-ape-squad`)
- [x] Uni-Fy (`uni-fy`) — unpublished until UNIFY mint/markets and live product surface are firmer
- [x] Villagers (`villagers`)
- [x] VINCENIA (`vincenia`)
- [x] Wegens (`wegens`) — deleted from catalog
- [x] Wolf Capital (`wolf-capital`)
- [x] Xape Labz (`xape-labz`)
- [x] ZomBabieZ (`zombabiez`)
