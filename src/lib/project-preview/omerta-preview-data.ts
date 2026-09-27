/**
 * Structured Omerta preview — mirrors future admin create/edit fields.
 * Keep existing listing chrome: collections dropdown + live ME sales stats + token block.
 */

import type { ProjectCollection } from "@/lib/project-collections";

/** Same shape as Project form fields we will add (strings = textareas / inputs). */
export type ProjectListingFields = {
  /** Concise review: what the project is, history, main benefits. */
  overview: string;
  /** Where holders stake (URL + platform name). */
  stakingWhere: string;
  /** What you receive from staking. */
  stakingRewards: string;
  /** Collection-specific staking / reward notes. */
  stakingCollectionNotes: string;
  /** Is the token LP-backed? Short answer + nuance. */
  tokenLpBacked: string;
  /** What holders can do with the primary token. */
  tokenUtility: string;
  /** Secondary token if relevant (name + role). */
  tokenSecondary: string;
  /** Holder utilities beyond staking (dashboard, traits, games, gates…). */
  holderUtility: string;
  /** Services offered to other collections / projects (blank if none). */
  services: string;
};

export const OMERTA_PREVIEW = {
  name: "Omerta - Empire City",
  bannerImageUrl:
    "https://460pdvehng61as9i.public.blob.vercel-storage.com/projects/c2db66cf-c6a6-4d1f-8687-a25377b3077c.jpg",
  websiteUrl: "https://www.omerta.so/",
  discordUrl: "https://discord.com/invite/empire-city",
  twitterUrl: "https://x.com/Omerta_SOL",
  tokenMint: "EmpirdtfUMfBQXEjnNmTngeimjfizfuSBD3TN9zqzydj",
  tokenLiquid: true,
  tokenName: "Empire",
  tokenImageUrl: "https://arweave.net/BwS0sd-P4pbiMhn-8bPCMrkJNTCKXUbe2DRVMXMkfZ4",
  /** Collections matching the live Slotto listing dropdown. */
  collections: [
    {
      name: "Soldiers",
      links: [
        {
          marketplace: "magicEden",
          href: "https://magiceden.io/marketplace/soldiers_of_the_empire",
        },
        {
          marketplace: "tensor",
          href: "https://www.tensor.trade/trade/soldiers_of_the_empire",
        },
        {
          marketplace: "orbis",
          href: "https://www.orbisonsol.io/marketplace/soldiers-of-the-empire",
        },
      ],
    },
    {
      name: "Capos",
      links: [
        {
          marketplace: "magicEden",
          href: "https://magiceden.io/marketplace/caporegime_del_empire",
        },
        {
          marketplace: "tensor",
          href: "https://www.tensor.trade/trade/caporegime_del_empire",
        },
        {
          marketplace: "orbis",
          href: "https://www.orbisonsol.io/marketplace/caporegime-del-empire",
        },
      ],
    },
    {
      name: "Dons",
      links: [
        {
          marketplace: "magicEden",
          href: "https://magiceden.io/marketplace/dons_of_the_empire",
        },
        {
          marketplace: "orbis",
          href: "https://www.orbisonsol.io/marketplace/donsoftheempire",
        },
      ],
    },
    {
      name: "Rilegatos family DAO",
      links: [
        {
          marketplace: "magicEden",
          href: "https://magiceden.io/marketplace/rilegato_family_dao",
        },
        {
          marketplace: "tensor",
          href: "https://www.tensor.trade/trade/rilegato_family_dao",
        },
        {
          marketplace: "orbis",
          href: "https://www.orbisonsol.io/marketplace/rilegato-family-dao",
        },
      ],
    },
    {
      name: "Capolavaro family DAO",
      links: [
        {
          marketplace: "magicEden",
          href: "https://magiceden.io/marketplace/capolavoro_family_dao",
        },
        {
          marketplace: "tensor",
          href: "https://www.tensor.trade/trade/capolavoro_family_dao",
        },
        {
          marketplace: "orbis",
          href: "https://www.orbisonsol.io/marketplace/capolavoro-family-dao",
        },
      ],
    },
  ] satisfies ProjectCollection[],
  /** Values as they would appear in admin inputs for this listing. */
  fields: {
    overview: `Omerta (Empire City) is a Solana mafia-themed ecosystem built around a ranked NFT hierarchy — SOLdiers, Caporegime, and Dons — plus Family SubDAOs and the $EMPIRE utility token. The project grew from the original Omerta families into a wider “Empire Utility Network” with staking, games, trait stores, bonds, and DAO governance. Main benefits for holders are rank-based staking and rewards, access to Empire Hub utilities, SubDAO participation, and (for higher ranks) revenue share / governance weight.`,

    stakingWhere: `Token staking: Lunarverse Omerta utilities (https://www.lunarverse.app/omerta/utilities/token-staking)
NFT / bond staking: GOTM / Omertà staking (https://stake.gotmlabz.io/empire)
Directory of all tools: Empire Hub (https://www.omerta.so/hub)`,

    stakingRewards: `$EMPIRE staking earns $BOSS; $BOSS staking earns $EMPIRE (two-step loop).
Eligible NFTs and Community Bonds stake for ecosystem yield / utility access.
Caporegime holders are tied to a share of Empire City utility revenue when staked.
SOLdiers stake for $EMPIRE and activity rewards (raids, quests, battles per whitepaper).`,

    stakingCollectionNotes: `SOLdiers — stake for $EMPIRE; trait store, quests, raids, voting once proposals clear higher ranks.
Caporegime — stake for utility revenue share; veto power in governance; can be locked with a Don for Family mint supply.
Dons — Council seat; permanently lock a Don to found a Family SubDAO (stated 400 NFT family supply).
Rilegato / Capolavoro — Family SubDAO lines with their own raffle / 1/1 swap utilities; stake via Empire NFT/bond surfaces where supported.
Community Bonds — claim yield on the Omertà staking platform; principal unlocks at maturity only.`,

    tokenLpBacked: `Tradeable on Solana DEXes (listed as liquid on Slotto; Jupiter-indexed). Omerta also runs treasury / community buyback-and-burn tracking. Full tokenomics page on omerta.so is still marked “coming soon” — treat LP depth and emissions as something to verify on-chain / Birdeye rather than assumed.`,

    tokenUtility: `$EMPIRE is the core ecosystem currency: staking, SubDAO activity, raffles, trait stores, loot boxes, swaps, marketplace activity, and internal rewards. Used to mint / interact with Community Bonds and as the equity-style layer of Empire City.`,

    tokenSecondary: `$BOSS — companion token framed as the primary spend/yield token at utilities (games, staking, trait stores). Site describes a 1:1 value relationship with $EMPIRE and a stake loop: stake $EMPIRE → earn $BOSS; stake $BOSS → earn $EMPIRE.`,

    holderUtility: `Empire Hub access: casino / games, scratch-offs, loot boxes, raffles, quests, Godhi Bank.
Trait stores for SOLdiers, Capos, and Rilegato (cosmetic / rank upgrades).
NFT↔$EMPIRE swaps for eligible Soldiers, Capos, bonds, and some allied NFTs.
Discord roles / quarters by rank (SOLdiers Quarters, Capo’s Corner); Chat2Earn and flex tools per whitepaper.
Governance path: Council of Dons → Capo veto → SOLdier majority vote.
Family SubDAO participation (Rilegato raffles, Capolavoro swaps, Belle Donne expansion).`,

    services: `Empire City is positioned as a multi-community utility network for Allied Projects / SubDAOs:
Founders Bonds — approved projects receive non-transferable $EMPIRE yield to distribute back to their NFT community (staking rewards, raffles, giveaways, approved utility spend — not SOL/USDC liquidation).
Allied benefits called out on-site: daily X raid via Omertà Engage, Empire Swap integration for the partner collection, cross-DAO promotions.
Shared infrastructure: staking, swaps, trait/raffle tooling other families can plug into under Council rules.`,
  } satisfies ProjectListingFields,
} as const;

/** Suggested extra admin fields (not filled on this preview). */
export const SUGGESTED_EXTRA_FIELDS = [
  {
    key: "verification",
    label: "Verification / eligibility",
    hint: "Discord + wallet link, unlisted-only rules, Matrica, etc.",
  },
  {
    key: "games",
    label: "Games / entertainment",
    hint: "Optional if games are a major product (casino, rumbles).",
  },
  {
    key: "governance",
    label: "Governance",
    hint: "Who votes, vetoes, Council — only if more than a sentence in holder utility.",
  },
  {
    key: "caveats",
    label: "Caveats",
    hint: "Short risk notes: mint authority, unfinished tokenomics, “coming soon”.",
  },
  {
    key: "tagline",
    label: "Tagline",
    hint: "One line under the name (schema already has tagline).",
  },
] as const;
