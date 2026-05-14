import { PublicKey } from "@solana/web3.js";

const ME_API = "https://api-mainnet.magiceden.dev/v2";

function isValidPubkey(s: string): boolean {
  try {
    new PublicKey(s.trim());
    return true;
  } catch {
    return false;
  }
}

async function fetchJson<T>(url: string, revalidateSec: number): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: revalidateSec },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** First listed NFT mint for a collection (used to resolve on-chain collection mint via DAS). */
async function fetchFirstListingMint(symbol: string, revalidateSec: number): Promise<string | null> {
  const url = `${ME_API}/collections/${encodeURIComponent(symbol)}/listings?offset=0&limit=1`;
  const arr = await fetchJson<Array<Record<string, unknown>>>(url, revalidateSec);
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const row = arr[0];
  const direct = row.tokenMint;
  if (typeof direct === "string" && isValidPubkey(direct)) return direct.trim();
  const token = row.token as Record<string, unknown> | undefined;
  const m = token?.mintAddress;
  if (typeof m === "string" && isValidPubkey(m)) return m.trim();
  return null;
}

function pickVerifiedCollectionMintFromAssetResult(result: Record<string, unknown> | null): string | null {
  if (!result) return null;

  const grouping = result.grouping;
  if (grouping && typeof grouping === "object" && !Array.isArray(grouping)) {
    const g = grouping as Record<string, unknown>;
    const colVal = g.collection;
    if (typeof colVal === "string" && isValidPubkey(colVal)) return colVal.trim();
  }
  if (Array.isArray(grouping)) {
    for (const entry of grouping) {
      if (!entry || typeof entry !== "object") continue;
      const o = entry as Record<string, unknown>;
      const gk = (o.group_key ?? o.groupKey ?? o.key) as string | undefined;
      const gv = (o.group_value ?? o.groupValue ?? o.value) as string | undefined;
      if (typeof gv === "string" && gv.length >= 32 && (gk === "collection" || gk === "Collection")) {
        if (isValidPubkey(gv)) return gv.trim();
      }
    }
  }

  const content = result.content as Record<string, unknown> | undefined;
  const metadata = content?.metadata as Record<string, unknown> | undefined;
  const coll = metadata?.collection;
  if (coll && typeof coll === "object" && !Array.isArray(coll)) {
    const c = coll as Record<string, unknown>;
    const key = c.key as string | undefined;
    if (typeof key === "string" && isValidPubkey(key)) return key.trim();
  }

  return null;
}

async function heliusRpc<T>(
  apiKey: string,
  method: string,
  params: unknown,
  revalidateSec: number,
): Promise<T | null> {
  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "slotto-helius", method, params }),
      next: { revalidate: revalidateSec },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: T; error?: unknown };
    if (json.error) return null;
    return json.result ?? null;
  } catch {
    return null;
  }
}

/** Verified collection mint from any NFT mint in that collection (Helius DAS getAsset). */
async function heliusCollectionMintFromSampleNft(
  nftMint: string,
  apiKey: string,
  revalidateSec: number,
): Promise<string | null> {
  const result = await heliusRpc<Record<string, unknown>>(
    apiKey,
    "getAsset",
    {
      id: nftMint.trim(),
      displayOptions: {
        showCollectionMetadata: true,
        showUnverifiedCollections: true,
      },
    },
    revalidateSec,
  );
  return pickVerifiedCollectionMintFromAssetResult(result);
}

/**
 * Total NFT count for a verified collection mint (Helius searchAssets + showGrandTotal).
 * Slower than ME stats; use when ME does not expose supply.
 */
async function heliusSearchAssetsCollectionGrandTotal(
  collectionMint: string,
  apiKey: string,
  revalidateSec: number,
): Promise<number | null> {
  const result = await heliusRpc<Record<string, unknown>>(
    apiKey,
    "searchAssets",
    {
      grouping: ["collection", collectionMint.trim()],
      limit: 1,
      page: 1,
      options: {
        showGrandTotal: true,
        showUnverifiedCollections: true,
      },
    },
    revalidateSec,
  );
  if (!result) return null;
  if (typeof result.total === "number" && Number.isFinite(result.total) && result.total >= 0) {
    return Math.round(result.total);
  }
  const assets = result.assets as Record<string, unknown> | undefined;
  if (typeof assets?.total === "number" && Number.isFinite(assets.total) && assets.total >= 0) {
    return Math.round(assets.total);
  }
  return null;
}

const ME_COLLECTION_MINT_KEYS = [
  "collectionMint",
  "collectionAddress",
  "onChainCollectionAddress",
  "verifiedCollectionMint",
  "collectionId",
] as const;

/** If Magic Eden collection JSON includes an on-chain collection mint, return it. */
export function extractCollectionMintFromMeCollection(col: Record<string, unknown> | null): string | null {
  if (!col) return null;
  for (const k of ME_COLLECTION_MINT_KEYS) {
    const v = col[k];
    if (typeof v === "string" && isValidPubkey(v)) return v.trim();
  }
  const nests = ["onChainCollectionData", "chainCollectionData", "collection"] as const;
  for (const nk of nests) {
    const n = col[nk];
    if (n && typeof n === "object" && !Array.isArray(n)) {
      const nested = n as Record<string, unknown>;
      for (const k of ME_COLLECTION_MINT_KEYS) {
        const v = nested[k];
        if (typeof v === "string" && isValidPubkey(v)) return v.trim();
      }
      const key = nested.key as string | undefined;
      if (typeof key === "string" && isValidPubkey(key)) return key.trim();
    }
  }
  return null;
}

/**
 * Resolve total supply when ME collection/stats omit it: Helius DAS counts assets
 * grouped by verified collection mint. Requires HELIUS_API_KEY.
 *
 * Tries, in order: collection doc mint fields → sample listing mint → getAsset → searchAssets total.
 */
export async function fetchCollectionNftCountViaHelius(
  symbol: string,
  meCollection: Record<string, unknown> | null,
  revalidateSec: number,
): Promise<string | null> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return null;

  const fromDoc = extractCollectionMintFromMeCollection(meCollection);
  let collectionMint = fromDoc;

  if (!collectionMint) {
    const sample = await fetchFirstListingMint(symbol, revalidateSec);
    if (!sample) return null;
    collectionMint = await heliusCollectionMintFromSampleNft(sample, apiKey, revalidateSec);
  }
  if (!collectionMint) return null;

  const total = await heliusSearchAssetsCollectionGrandTotal(collectionMint, apiKey, revalidateSec);
  if (total != null) return String(total);

  /** Last resort: paginate search results (capped) if grand total is unavailable. */
  let sum = 0;
  const limit = 1000;
  const maxPages = 100;
  for (let page = 1; page <= maxPages; page++) {
    const pageResult = await heliusRpc<Record<string, unknown>>(
      apiKey,
      "searchAssets",
      {
        grouping: ["collection", collectionMint.trim()],
        limit,
        page,
        tokenType: "all",
        options: { showUnverifiedCollections: true },
      },
      revalidateSec,
    );
    const items = pageResult?.items;
    const batch = Array.isArray(items) ? items.length : 0;
    sum += batch;
    if (batch < limit) break;
  }
  return sum > 0 ? String(sum) : null;
}
