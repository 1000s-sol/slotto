/**
 * Hardcoded Omerta preview content for /project-preview.
 * Sourced from the published Slotto listing + omerta.so (Mar 2026 scrape).
 * Not wired to the Project DB — layout experiment only.
 */

export const OMERTA_PREVIEW = {
  name: "Omerta - Empire City",
  tagline: "Enter the family. Rise through the ranks.",
  summary:
    "A mafia-themed Solana ecosystem built around ranked NFT collections, the $EMPIRE utility token, staking loops, Family SubDAOs, and Empire City tools.",
  bannerImageUrl:
    "https://460pdvehng61as9i.public.blob.vercel-storage.com/projects/c2db66cf-c6a6-4d1f-8687-a25377b3077c.jpg",
  tags: ["NFT", "Token", "Staking", "Games", "DAO"],
  facts: [
    { label: "Network", value: "Solana" },
    { label: "Hierarchy", value: "Soldier → Capo → Don" },
    { label: "Core token", value: "$EMPIRE" },
    { label: "Companion token", value: "$BOSS" },
    { label: "Hub", value: "Empire Hub" },
  ],
  links: {
    website: "https://www.omerta.so/",
    discord: "https://discord.com/invite/empire-city",
    twitter: "https://x.com/Omerta_SOL",
    hub: "https://www.omerta.so/hub",
    whitepaper: "https://www.omerta.so/whitepaper",
  },
  overview: [
    "Omerta positions Empire City as a branded utility network rather than a single PFP drop: ranked NFTs, $EMPIRE as the shared currency, SubDAO families, and a hub of staking, games, trait stores, and bonds.",
    "Status runs Soldier → Caporegime → Don. Collections unlock staking, governance weight, revenue shares, and the right for Dons to found Family SubDAOs under the wider Empire umbrella.",
  ],
  collections: [
    {
      name: "Don's of the $Empire",
      role: "Head of the Family",
      blurb:
        "Highest tier of the hierarchy. Dons lead families, sit on the Council of Dons, and can permanently lock a Don to mint a new Family SubDAO.",
    },
    {
      name: "Caporegime del $Empire",
      role: "Captain of the DAO",
      blurb:
        "Captains share Empire City utility revenue (site states 50% of generated revenue) and hold veto power in governance when staked.",
    },
    {
      name: "SOLdiers of the $Empire",
      role: "Citizens of Empire City",
      blurb:
        "Core holder base. Stake for $EMPIRE, use trait stores, quests, raids, and vote once proposals clear Capo/Don filters.",
    },
    {
      name: "Rilegato Family SOLdiers",
      role: "First Family SubDAO",
      blurb:
        "Allied raffle-focused SubDAO expanding the $EMPIRE utility network, with its own trait store and holder reward flow.",
    },
    {
      name: "Capolavoro Family Soldiers",
      role: "1/1 art branch",
      blurb:
        "Masterpiece-style 1/1 collection lane with swap utilities for revealing or exchanging Capolavoro art.",
    },
    {
      name: "Belle Donne Family SOLdiers",
      role: "Female IP expansion",
      blurb:
        "Official female expansion of the Omerta SOLdier IP, framed as a growing Family branch inside Empire City.",
    },
  ],
  token: {
    symbol: "EMPIRE",
    name: "Empire",
    mint: "EmpirdtfUMfBQXEjnNmTngeimjfizfuSBD3TN9zqzydj",
    logoUrl: "https://arweave.net/BwS0sd-P4pbiMhn-8bPCMrkJNTCKXUbe2DRVMXMkfZ4",
    liquid: true,
    role: "$EMPIRE is the core utility and equity-style layer across Empire City: staking, SubDAO activity, marketplace/swaps, raffles, trait access, and internal rewards.",
    companion: {
      symbol: "BOSS",
      blurb:
        "$BOSS is presented as the primary spend/yield token at utilities (games, staking, trait stores), paired 1:1 in value narrative with $EMPIRE and used in a two-step stake loop ($EMPIRE → $BOSS → $EMPIRE).",
    },
    sinks: [
      "Staking systems and investment loops",
      "Trait stores, raffles, loot boxes, and games",
      "Swaps between eligible NFTs/bonds and $EMPIRE",
      "Community buybacks and burns tracked on omerta.so",
    ],
  },
  staking: [
    {
      title: "$EMPIRE staking",
      detail: "Stake $EMPIRE to earn $BOSS — step 1 of the published investment loop.",
      href: "https://www.lunarverse.app/omerta/utilities/token-staking",
    },
    {
      title: "$BOSS staking",
      detail: "Stake $BOSS to earn $EMPIRE — step 2 of the loop.",
      href: "https://www.lunarverse.app/omerta/utilities/token-staking",
    },
    {
      title: "NFT / bond staking",
      detail:
        "Stake eligible NFTs and Community Bonds for yield and family utility access via Omertà / GOTM staking surfaces.",
      href: "https://stake.gotmlabz.io/empire",
    },
    {
      title: "Rank boosts",
      detail:
        "Site materials describe reward boosts from NFT attributes, trait utility, and longer lock durations; Capos/Dons also gate governance weight.",
      href: null,
    },
  ],
  utilities: [
    {
      title: "Empire Hub",
      detail: "Single directory for staking, raffles, loot boxes, games, trait stores, quests, and SubDAO links.",
      href: "https://www.omerta.so/hub",
    },
    {
      title: "Games & casino",
      detail: "Casino-style game room, scratch-offs, loot boxes, and raffles for ecosystem prizes.",
      href: "https://omerta-casino-ten.vercel.app",
    },
    {
      title: "Quests",
      detail: "Dynamic missions for tokens, NFTs, and rare rewards via Lunarverse Omerta utilities.",
      href: "https://www.lunarverse.app/omerta/utilities/quests",
    },
    {
      title: "Trait stores",
      detail: "Separate stores for SOLdiers, Capos, and Rilegato — cosmetic and rank-linked upgrades.",
      href: "https://www.gotmlabz.io/traitstore/rilegato-family-dao",
    },
    {
      title: "Godhi Bank",
      detail: "Banking hub for ecosystem rewards and balances (listed in Empire Hub).",
      href: "https://www.omerta.so/hub",
    },
    {
      title: "NFT / SPL swaps",
      detail:
        "Swap eligible Bond staking contracts, SOLdiers, Caporegime, and select allied NFTs into $EMPIRE.",
      href: "https://www.shift3.app/swap/bonds",
    },
  ],
  bonds: [
    {
      title: "Empire City Community Bonds",
      detail:
        "Time-locked, yield-bearing NFT instruments with defined face value, maturity, and daily yield (often $EMPIRE; some series use other ecosystem tokens). Transferable unless a series says otherwise; principal unlocks only at maturity.",
    },
    {
      title: "Founders Bonds",
      detail:
        "Non-transferable $EMPIRE-yield instruments for approved Allied Projects / SubDAOs. Yield is meant to flow back to that project's NFT community under Council rules (not liquidated to SOL/USDC).",
    },
    {
      title: "Buybacks",
      detail:
        "Omerta publishes an Empire Buy Backs page tracking on-chain $EMPIRE burns from treasury/community activity.",
    },
  ],
  familyDaos: [
    {
      name: "Rilegato",
      focus: "Raffle DAO",
      detail: "First Family SubDAO — raffles, holder rewards, trait store, $EMPIRE network participation.",
    },
    {
      name: "Capolavoro",
      focus: "1/1 art",
      detail: "Art-first allied family with masterpiece 1/1s and Capolavoro swap tooling.",
    },
    {
      name: "Belle Donne",
      focus: "IP expansion",
      detail: "Female SOLdier IP branch framed for further community and utility growth.",
    },
  ],
  /** House-style editorial close — grounded in omerta.so + existing Slotto listing themes. */
  reviewMd: `Omerta runs Empire City as a Solana mafia narrative wrapped around a real product surface: ranked NFT lines (SOLdiers, Caporegime, Dons), Family SubDAOs such as Rilegato, Capolavoro, and Belle Donne, and a shared $EMPIRE economy with a paired $BOSS spend/yield loop. The public site organises that stack into collections, utilities, bonds, buybacks, and an Empire Hub rather than a single mint page, which is the clearest way to read the project when comparing listings.

Holder mechanics split by rank. SOLdiers are the volume layer for staking, traits, quests, and votes; Caporegime holders are tied to utility revenue share and proposal veto weight; Dons sit on the Council and can lock into founding a Family SubDAO. Around that hierarchy sit Community Bonds and Founders Bonds (time-locked or project-gated yield instruments), Lunarverse/GOTM staking links, casino and raffle tools, and trait stores — so day-to-day value depends on using those loops, not only holding a floor PFP.

Tokenomics detail on omerta.so is still marked coming soon, and several roadmap items in Phase 4 (wider listings, deeper alliances) remain in progress, so claims about distribution or exchange coverage should be checked against live dashboards. For visitors comparing listings, Omerta stands out when you want a multi-collection hierarchy plus an active utility hub; weigh that against the usual Solana caveats around yield instruments, mint authority for bond rewards, and how much of the stack you will actually stake and claim.`,
} as const;
