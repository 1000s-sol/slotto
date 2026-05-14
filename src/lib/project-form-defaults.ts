import { magicEdenCollectionUrls } from "@/lib/magiceden-stats";

export type ProjectFormDefaults = {
  slug: string;
  name: string;
  published: boolean;
  reviewMd: string;
  /** At least two slots; first is primary (ME stats). */
  meUrlsInitial: string[];
  discordUrl: string;
  twitterUrl: string;
  websiteUrl: string;
  tokenMint: string;
  bannerImageUrl: string;
  listingImageUrl: string;
  marketplacesJson: string;
};

export const emptyDefaults: ProjectFormDefaults = {
  slug: "",
  name: "",
  published: false,
  reviewMd: "",
  meUrlsInitial: ["", ""],
  discordUrl: "",
  twitterUrl: "",
  websiteUrl: "",
  tokenMint: "",
  bannerImageUrl: "",
  listingImageUrl: "",
  marketplacesJson: "[]",
};

function padMeUrlsMinTwo(urls: string[]): string[] {
  const out = urls.map((s) => s.trim());
  while (out.length < 2) out.push("");
  return out;
}

/** Server-safe: build ProjectForm props from a Prisma `Project` row. */
export function defaultsFromProject(p: {
  slug: string;
  name: string;
  published: boolean;
  reviewMd: string;
  meUrl: string | null;
  meUrls: unknown;
  discordUrl: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  tokenMint: string | null;
  bannerImageUrl: string | null;
  listingImageUrl: string | null;
  marketplaces: unknown;
}): ProjectFormDefaults {
  return {
    slug: p.slug,
    name: p.name,
    published: p.published,
    reviewMd: p.reviewMd,
    meUrlsInitial: padMeUrlsMinTwo(magicEdenCollectionUrls(p.meUrls, p.meUrl)),
    discordUrl: p.discordUrl ?? "",
    twitterUrl: p.twitterUrl ?? "",
    websiteUrl: p.websiteUrl ?? "",
    tokenMint: p.tokenMint ?? "",
    bannerImageUrl: p.bannerImageUrl ?? "",
    listingImageUrl: p.listingImageUrl ?? "",
    marketplacesJson: JSON.stringify(Array.isArray(p.marketplaces) ? p.marketplaces : [], null, 2),
  };
}
