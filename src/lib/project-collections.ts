import {
  isMarketplaceId,
  marketplaceIdFromHref,
  type MarketplaceId,
} from "@/lib/marketplace-icons";
import { magicEdenCollectionUrls, parseMagicEdenCollectionSymbol } from "@/lib/magiceden-stats";

export type CollectionLink = {
  marketplace: MarketplaceId;
  href: string;
};

export type ProjectCollection = {
  /** Optional label in the collection dropdown; auto-derived from ME URL when empty. */
  name: string;
  links: CollectionLink[];
};

type LegacyMpRow = { label: string; href: string };

function asLegacyMarketplaces(raw: unknown): LegacyMpRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is LegacyMpRow =>
      !!x &&
      typeof x === "object" &&
      typeof (x as LegacyMpRow).label === "string" &&
      typeof (x as LegacyMpRow).href === "string",
  );
}

function parseCollectionsArray(raw: unknown): ProjectCollection[] {
  if (!Array.isArray(raw)) return [];
  const out: ProjectCollection[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const name = String(rec.name ?? "").trim();
    const linksRaw = rec.links;
    if (!Array.isArray(linksRaw)) continue;
    const links: CollectionLink[] = [];
    for (const link of linksRaw) {
      if (!link || typeof link !== "object") continue;
      const lr = link as Record<string, unknown>;
      const marketplace = String(lr.marketplace ?? "").trim();
      const href = String(lr.href ?? "").trim();
      if (!isMarketplaceId(marketplace) || !href) continue;
      links.push({ marketplace, href });
    }
    if (links.length) out.push({ name, links });
  }
  return out;
}

function migrateLegacy(
  meUrls: unknown,
  meUrl: string | null | undefined,
  marketplaces: unknown,
): ProjectCollection[] {
  const meList = magicEdenCollectionUrls(meUrls, meUrl);
  const legacyMps = asLegacyMarketplaces(marketplaces);

  const cols: ProjectCollection[] = meList.map((url) => ({
    name: "",
    links: [{ marketplace: "magicEden" as const, href: url }],
  }));

  if (cols.length === 0) {
    return [];
  }

  if (legacyMps.length) {
    const seen = new Set(cols[0].links.map((l) => l.marketplace));
    for (const mp of legacyMps) {
      const id =
        marketplaceIdFromHref(mp.href) ??
        (mp.label.toLowerCase().includes("tensor")
          ? "tensor"
          : mp.label.toLowerCase().includes("grave")
            ? "gravemarket"
            : mp.label.toLowerCase().includes("orbis")
              ? "orbis"
              : mp.label.toLowerCase().includes("magic")
                ? "magicEden"
                : null);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      cols[0].links.push({ marketplace: id, href: mp.href.trim() });
    }
  }

  return cols;
}

/** Read collections from `collections` JSON, else migrate `meUrls` + `marketplaces`. */
export function parseProjectCollections(
  collections: unknown,
  meUrls: unknown,
  meUrl: string | null | undefined,
  marketplaces: unknown,
): ProjectCollection[] {
  const fromNew = parseCollectionsArray(collections);
  if (fromNew.length) return fromNew;
  return migrateLegacy(meUrls, meUrl, marketplaces);
}

export function magicEdenLink(collection: ProjectCollection): string | null {
  const link = collection.links.find((l) => l.marketplace === "magicEden" && l.href.trim());
  return link?.href.trim() ?? null;
}

export function collectionDisplayName(collection: ProjectCollection, index: number): string {
  if (collection.name.trim()) return collection.name.trim();
  const me = magicEdenLink(collection);
  if (me) {
    const sym = parseMagicEdenCollectionSymbol(me);
    if (sym) return sym.replace(/_/g, " ");
  }
  const first = collection.links[0];
  if (first?.href) {
    try {
      const path = new URL(first.href).pathname.split("/").filter(Boolean).pop();
      if (path) return decodeURIComponent(path).replace(/_/g, " ");
    } catch {
      /* ignore */
    }
  }
  return index === 0 ? "Primary collection" : `Collection ${index + 1}`;
}

/** All Magic Eden URLs in collection order (for legacy `meUrls` sync). */
export function allMagicEdenUrls(collections: ProjectCollection[]): string[] {
  const out: string[] = [];
  for (const c of collections) {
    const me = magicEdenLink(c);
    if (me) out.push(me);
  }
  return out;
}

export function primaryMagicEdenFromCollections(collections: ProjectCollection[]): string | null {
  return magicEdenLink(collections[0] ?? { name: "", links: [] });
}

export function collectionsForEditor(
  collections: unknown,
  meUrls: unknown,
  meUrl: string | null | undefined,
  marketplaces: unknown,
): ProjectCollection[] {
  return parseProjectCollections(collections, meUrls, meUrl, marketplaces).map((c) => ({
    ...c,
    links: c.links.map((l) => ({ ...l })),
  }));
}

export function validateCollectionsJson(raw: string): {
  collections: ProjectCollection[];
  meUrl: string | null;
  meUrls: string[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim() || "[]") as unknown;
  } catch {
    throw new Error("Collections: invalid JSON.");
  }
  if (!Array.isArray(parsed)) throw new Error("Collections must be a JSON array.");

  const collections: ProjectCollection[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    if (!row || typeof row !== "object") {
      throw new Error(`Collection ${i + 1} must be an object.`);
    }
    const rec = row as Record<string, unknown>;
    const name = String(rec.name ?? "").trim();
    const linksRaw = rec.links;
    if (!Array.isArray(linksRaw)) {
      throw new Error(`Collection ${i + 1}: links must be an array.`);
    }
    const links: CollectionLink[] = [];
    const seenMp = new Set<MarketplaceId>();
    for (let j = 0; j < linksRaw.length; j++) {
      const link = linksRaw[j];
      if (!link || typeof link !== "object") {
        throw new Error(`Collection ${i + 1}, link ${j + 1}: invalid.`);
      }
      const lr = link as Record<string, unknown>;
      const marketplace = String(lr.marketplace ?? "").trim();
      const href = String(lr.href ?? "").trim();
      if (!href) continue;
      if (!isMarketplaceId(marketplace)) {
        throw new Error(`Collection ${i + 1}, link ${j + 1}: unknown marketplace.`);
      }
      if (!/^https?:\/\//i.test(href)) {
        throw new Error(`Collection ${i + 1}, link ${j + 1}: URL must start with http:// or https://.`);
      }
      if (seenMp.has(marketplace)) {
        throw new Error(`Collection ${i + 1}: duplicate ${marketplace} link.`);
      }
      seenMp.add(marketplace);
      links.push({ marketplace, href });
    }
    if (links.length === 0) continue;
    if (collections.length === 0 && !links.some((l) => l.marketplace === "magicEden")) {
      throw new Error(
        "Primary collection must include a Magic Eden link when using marketplace listings (live floor/volume stats).",
      );
    }
    collections.push({ name, links });
  }

  const meUrls = allMagicEdenUrls(collections);
  return {
    collections,
    meUrl: meUrls[0] ?? null,
    meUrls,
  };
}
