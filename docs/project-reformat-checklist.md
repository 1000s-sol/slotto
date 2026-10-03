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

## Checklist (125 published)

Tick in this file as each listing is reformatted. Keep alphabetical by name.

- [x] Absurd Apes (`absurd-apes`)
- [x] ABC (`abc`)
- [x] Aevon (`aevon`)
- [x] Alpha Gardeners (`alpha-gardeners`)
- [x] Anomaly (`anomaly`)
- [x] Aurorians (`aurorians`)
- [x] B & H Club (`b-h-club`) — includes Degens X
- [x] Battle Bros Club (`battle-bros-club`)
- [x] Big Cats (`big-cats`)
- [x] Big Head Billionaires (`big-head-billionaires`)
- [x] BoDoggos (`bodoggos`)
- [x] Bobos of War (`bobos-of-war`)
- [x] Bohemia Art Fair (`bohemia`) — includes Euphoria and Fabulosa
- [x] Bozo Collective (`bozo-collective`) — includes Bozo Council
- [x] Bored Ape Sol Club (`bored-ape-sol-club`) — includes XElementia
- [x] BR1 Infinite (`br1`) — includes Ape Operatives and Droid Operatives
- [x] Bulls on Sol Society (`bulls-on-sol-society`)
- [x] BUXDAO (`buxdao`)
- [x] CETS (`cets`)
- [x] Chart Breakers (`chart-breakers`)
- [x] Claynosaurz (`claynosaurz`)
- [x] Collector Crypt (`collector-crypt`) — includes Card Club membership pass
- [x] Crouton Jones (`crouton-jones`) — includes Croutonverse Founder's Pass
- [x] Critters Cult (`critters-cult`) — includes Solsunsets
- [x] Critters Quest (`critters-quest`) — includes Quest Items and Multipliers
- [x] Catalina Whale Mixer (`catalina-whale-mixer`)
- [x] Chadbots (`chadbots`)
- [x] Coral Tribe (`coral-tribe`)
- [x] Cyber Frogs (`cyber-frogs`)
- [x] D1srupt0rs (`d1srupt0rs`)
- [x] D3fenders (`d3fenders`)
- [x] Dead Bunnies (`dead-bunnies`)
- [x] Dead King Society (`dead-king-society`) — includes Nobles
- [x] Degenerate Ape Academy (`degenerate-ape-academy`) — includes Degenerate Trash Pandas and Degenerate Drop Bears
- [x] Dgenz (`dgenz`) — includes Radiated Boyz and Degen Pharaohz
- [x] DEGEN DOJO (`degen-dojo`)
- [x] Degen Fat Cats (`degen-fat-cats`)
- [x] Decentric (`decentric`)
- [x] DeGods (`degods`) — includes y00ts
- [x] DMST (`dmst`)
- [x] DKV (`dkv`)
- [x] Doge Capital (`doge-capital`)
- [x] Donk (`donk`)
- [x] Doopies (`doopies`)
- [x] Drifters (`drifters`) — Drifters: Masterwork
- [x] EAPES (`eapes`)
- [x] Elevens (`elevens`) — includes Twelves
- [x] Enchanted Miners (`enchanted-miners`)
- [x] Energy Wabbits (`energy-wabbits`)
- [x] Fuddy Dogs (`fuddy-dogs`)
- [x] Famous Fox Federation (`famous-fox-federation`)
- [x] Frens Factory (`frens-factory`)
- [x] Frogana (`frogana`)
- [x] Gearhead Coin (`gearhead-coin`) — includes Rusty Rigs
- [x] Giraffe Tower (`giraffe-tower`)
- [x] GOTM Labz (`gotm-labz`) — was GAINZ; includes GAINZ
- [x] Galactic Geckos (`galactic-geckos`)
- [x] Gamba Dogs (`gamba-dogs`)
- [x] Geeks (`geeks`)
- [x] Gensuki (`gensuki`)
- [x] GoodFellas (`goodfellas`)
- [x] Goofy Giraffes (`goofy-giraffes`)
- [x] Goats of Solana (`goats-of-solana`) — includes Cave Creative
- [x] Grim Syndicate (`grim-syndicate`)
- [x] Haxz (`haxz`)
- [x] K.B.D.S (`k-b-d-s`)
- [x] Kups by Raposa (`kups-by-raposa`)
- [x] Kreechures (`kreechures`)
- [x] Liberty Square (`liberty-square`) — includes The Hallowed
- [x] LILY (`lily`) — The Lotus brand
- [x] Lifinity Flares (`lifinity-flares`)
- [x] Liminals (`liminals`)
- [x] Lions of Liquania (`lions-of-liquania`)
- [x] LLama (`llpic`)
- [x] Loud Lords (`loud-lords`) — unpublished until more remint/takeover info
- [x] Lunarverse (`lunarverse`)
- [x] Mad Lads (`mad-lads`)
- [x] MAGApixel (`magapixel`)
- [x] Market Elites (`marketelites`)
- [x] Matrica Labs (`matrica-labs`) — includes Pixels and Corrupted
- [x] Mavrix by Jelly Co (`mavrix`) — includes Gamerooms
- [x] Midevils (`midevils`)
- [x] Mindfolk (`mindfolk`) — includes Mindlings
- [x] Meerkat Millionaires (`meerkat`)
- [x] Micros (`micros`) — includes Solnautz
- [x] Mnk3y Labs (`mnk3y-labs`)
- [x] Mob Collective (`mob-collective`)
- [x] Mutants On Sol Crew (`mutants-on-sol-crew`)
- [x] NPP (`npp`)
- [x] Okay Bears (`okay-bears`) — includes Bear Drop Founders Coins
- [x] Omerta - Empire City (`omerta-empire-city`)
- [x] OMEN (`omen`)
- [x] Onchain Bridges (`onchain-bridges`)
- [x] Ovols (`ovols`)
- [x] Owltopia (`owltopia`)
- [x] Pandarianz (`pandarianz`)
- [x] Pawpular (`pawpular`)
- [x] Pesky Penguins (`pesky-penguins`)
- [x] Peanut Protocol (`peanut-protocol`)
- [x] Pepeverse (`pepeverse`)
- [x] Pixel by Pixel (`pixel-by-pixel`) — includes Candies, Morbies, Drippies, Great Goats, Undead Genesis
- [x] Pickles (`pickles`)
- [x] Play Solana (`play-solana`) — includes Player2 and Play Solana NFT
- [x] Planet Kaiju (`planet-kaiju`) — includes The Hated
- [x] Portals (`portals`)
- [x] Primates (`primates`)
- [x] Primos (`primos`)
- [x] Primals (`primals`)
- [x] Puffsterz (`puffsterz`)
- [x] Pythenians (`pythenians`)
- [x] Rafflors (`rafflors`)
- [x] Rogues (`rogues`)
- [x] Saga Monkes (`saga-monkes`)
- [x] Sensei (`sensei`)
- [x] Shaolin Saga (`shaolin-saga`)
- [x] Shinigami (`shinigami`)
- [x] Smyths (`smyths`)
- [x] SoDead (`sodead`)
- [x] SOL Decoder (`sol-decoder`)
- [x] Solana Deads (`solana-deads`)
- [x] Solcasino.io (`solcasino`)
- [x] Solana Monkey Business (`solana-monkey-business`)
- [x] Solana Sky Pilots (`solana-sky-pilots`) — unpublished until Sky Pilot NFT markets/mint details are firmer
- [x] Solana Strays (`solana-strays`)
- [x] Solsteads (`solsteads`) — includes Citizens
- [x] Solanons (`solanons`)
- [x] Solarians (`solarians`)
- [x] SolGods (`solgods`)
- [x] Stone Gods (`stone-gods`)
- [x] Stoned Ape Crew (`stoned-apes`) — includes Nuked Apes
- [x] Stoned Sloths (`stoned-sloths`)
- [x] Steakers (`steakers`)
- [x] Taiyo Robotics (`taiyo-robotics`) — includes Infants, Oil, Pilots
- [x] TenseiEXE (`tenseiexe`)
- [x] Thugbirdz (`thugbirdz`)
- [x] Tensorians (`tensorians`)
- [x] THC Labz (`thc-labz`)
- [x] The Chimpions (`the-chimpions`)
- [x] The Fracture (`the-fracture`) — includes Gods and Omnium
- [x] The Fox Club (`the-fox-club`) — includes Cyber Foxes
- [x] The Misfits Order (`the-misfits-order`)
- [x] The Northlanders (`the-northlanders`)
- [x] The Rejects (`the-rejects`)
- [x] The Strays (`the-strays`)
- [x] Tribal Games (`tribal-games`) — includes Trippin' Ape Tribe and Arcadians
- [x] Ugly Ape Squad (`ugly-ape-squad`)
- [x] Uni-Fy (`uni-fy`) — unpublished until UNIFY mint/markets and live product surface are firmer
- [x] Villagers (`villagers`)
- [x] VINCENIA (`vincenia`)
- [x] VTOPIANS (`vtopians`) — includes Vtopian Monolith
- [x] Wassieverse (`wassieverse`)
- [x] Wegens (`wegens`) — deleted from catalog
- [x] Whal3s (`whal3s`)
- [x] Wolf Capital (`wolf-capital`)
- [x] Xape Labz (`xape-labz`)
- [x] ZomBabieZ (`zombabiez`)
