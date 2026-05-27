import { collectionsForEditor } from "@/lib/project-collections";

export type ProjectFormDefaults = {
  slug: string;
  name: string;
  published: boolean;
  reviewMd: string;
  collectionsInitial: ReturnType<typeof collectionsForEditor>;
  discordUrl: string;
  twitterUrl: string;
  websiteUrl: string;
  tokenMint: string;
  tokenLiquid: boolean;
  tokenImageUrl: string;
  tokenName: string;
  bannerImageUrl: string;
  listingImageUrl: string;
};

export const emptyDefaults: ProjectFormDefaults = {
  slug: "",
  name: "",
  published: false,
  reviewMd: "",
  collectionsInitial: [],
  discordUrl: "",
  twitterUrl: "",
  websiteUrl: "",
  tokenMint: "",
  tokenLiquid: true,
  tokenImageUrl: "",
  tokenName: "",
  bannerImageUrl: "",
  listingImageUrl: "",
};

/** Server-safe: build ProjectForm props from a Prisma `Project` row. */
export function defaultsFromProject(p: {
  slug: string;
  name: string;
  published: boolean;
  reviewMd: string;
  meUrl: string | null;
  meUrls: unknown;
  collections?: unknown;
  marketplaces: unknown;
  discordUrl: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  tokenMint: string | null;
  tokenLiquid?: boolean;
  tokenImageUrl?: string | null;
  tokenName?: string | null;
  bannerImageUrl: string | null;
  listingImageUrl: string | null;
}): ProjectFormDefaults {
  return {
    slug: p.slug,
    name: p.name,
    published: p.published,
    reviewMd: p.reviewMd,
    collectionsInitial: collectionsForEditor(p.collections, p.meUrls, p.meUrl, p.marketplaces),
    discordUrl: p.discordUrl ?? "",
    twitterUrl: p.twitterUrl ?? "",
    websiteUrl: p.websiteUrl ?? "",
    tokenMint: p.tokenMint ?? "",
    tokenLiquid: p.tokenLiquid ?? true,
    tokenImageUrl: p.tokenImageUrl ?? "",
    tokenName: p.tokenName ?? "",
    bannerImageUrl: p.bannerImageUrl ?? "",
    listingImageUrl: p.listingImageUrl ?? "",
  };
}
