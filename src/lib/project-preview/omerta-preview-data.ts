/**
 * Omerta preview — fixed 5 content tiles for /project-preview.
 * Keeps existing listing chrome: collections dropdown + ME stats + token block.
 */

import type { ProjectCollection } from "@/lib/project-collections";

export type PreviewSectionId =
  | "overview"
  | "staking"
  | "token"
  | "holderUtility"
  | "services";

export type PreviewSection = {
  id: PreviewSectionId;
  label: string;
  body: string;
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
  /** Exactly five tiles — future admin fields map 1:1. */
  sections: [
    {
      id: "overview",
      label: "Overview",
      body: `Omerta Empire City is a Solana ecosystem built around a mafia hierarchy of NFT collections — SOLdiers, Caporegime, and Dons — together with Family SubDAOs and the $EMPIRE token. The project grew out of the original Omerta families into a wider utility network that includes staking, games, trait stores, bonds, and DAO governance. For holders, the main draw is rank-based rewards and status, access to Empire Hub tools, and, at higher tiers, revenue share and governance weight inside that network.`,
    },
    {
      id: "staking",
      label: "Rewards / staking",
      body: `Token staking runs through Lunarverse’s Omerta utilities, while NFT and bond staking are handled on the GOTM / Omertà staking platform, with everything also linked from Empire Hub. Staking $EMPIRE earns $BOSS, and staking $BOSS earns $EMPIRE, forming a two-step reward loop. SOLdiers stake for $EMPIRE and activity rewards, Caporegime holders share Empire City utility revenue when staked, Dons unlock Council participation and the ability to found Family SubDAOs, and Community Bonds pay a defined daily yield until maturity.`,
    },
    {
      id: "token",
      label: "Token",
      body: `$EMPIRE is the core tradeable token for the ecosystem and is indexed on Jupiter; liquidity depth should be checked on-chain rather than assumed. Holders use $EMPIRE for staking, raffles, trait stores, swaps, bond activity, and SubDAO participation across Empire City. The secondary token is $BOSS, which the project presents as the main spend and yield token at utilities and as the other half of the $EMPIRE staking loop.`,
    },
    {
      id: "holderUtility",
      label: "Holder utility",
      body: `Beyond staking, holders get access to Empire Hub products such as the casino and games, loot boxes, raffles, quests, and Godhi Bank. Trait stores let SOLdiers, Capos, and Rilegato holders upgrade cosmetics and rank-linked options, and eligible NFTs can be swapped into $EMPIRE. Rank also gates Discord spaces and a governance path from the Council of Dons through Caporegime veto to SOLdier votes, while Family lines like Rilegato, Capolavoro, and Belle Donne add SubDAO-specific tools on top of the shared hub.`,
    },
    {
      id: "services",
      label: "Services",
      body: `Omerta also packages Empire City as infrastructure other collections can plug into. Approved Allied Projects can receive Founders Bonds that yield $EMPIRE for redistribution into their own NFT communities, along with Empire Swap integration, cross-DAO promotions, and shared staking, raffle, and trait tooling under Council rules. That makes the project relevant not only as its own PFP stack, but as a utility network offered to partner collections.`,
    },
  ] satisfies PreviewSection[],
} as const;
