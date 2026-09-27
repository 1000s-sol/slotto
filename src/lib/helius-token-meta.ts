import {
  heliusJsonRpcUrl,
  parseHeliusApiKeys,
} from "@/lib/helius-api-keys";
import { isRpcFallbackError } from "@/lib/lottery/rpc-url";

/** Pinata is reliable for Solana token metadata CIDs; Cloudflare/ipfs.io often 429 or hang. */
const PREFERRED_IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

/** Extract an IPFS CID (+ optional path) from ipfs:// or gateway /ipfs/ paths. */
function extractIpfsPath(url: string): string | null {
  const u = url.trim();
  if (u.startsWith("ipfs://")) {
    const rest = u.slice("ipfs://".length).replace(/^ipfs\//i, "");
    return rest || null;
  }
  const m = u.match(/\/ipfs\/([^?#]+)/i);
  return m?.[1] ?? null;
}

/**
 * Many token images are ipfs:// or public gateways that rate-limit / hang.
 * Rewrite every IPFS URL onto Pinata; leave other https/data URLs as-is.
 * Also normalizes ar:// → arweave.net.
 */
export function normalizeImageUrl(url: string | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;

  const ipfsPath = extractIpfsPath(u);
  if (ipfsPath) {
    return `${PREFERRED_IPFS_GATEWAY}${ipfsPath}`;
  }

  if (u.startsWith("ar://")) {
    return `https://arweave.net/${u.slice("ar://".length)}`;
  }

  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) {
    return u;
  }
  return u;
}

export type HeliusTokenMeta = { symbol?: string; image?: string };

async function fetchHeliusAsset(
  mint: string,
  apiKey: string,
): Promise<HeliusTokenMeta | null> {
  const res = await fetch(heliusJsonRpcUrl(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "slotto-token-meta",
      method: "getAsset",
      params: {
        id: mint.trim(),
        displayOptions: { showFungible: true },
      },
    }),
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Helius getAsset ${res.status}: ${text.slice(0, 120)}`);
  }
  const json = (await res.json()) as { result?: Record<string, unknown> };
  const r = json.result as Record<string, unknown> | undefined;
  if (!r) return null;
  const content = r.content as Record<string, unknown> | undefined;
  const metadata = content?.metadata as Record<string, unknown> | undefined;
  const links = content?.links as Record<string, unknown> | undefined;
  const tokenInfo = r.token_info as Record<string, unknown> | undefined;
  const files = content?.files as Array<{ uri?: string; mime?: string }> | undefined;

  const symRaw =
    (metadata?.symbol as string | undefined)?.trim() ||
    (tokenInfo?.symbol as string | undefined)?.trim();

  const rawImage =
    (links?.image as string | undefined)?.trim() ||
    (typeof metadata?.image === "string" ? metadata.image.trim() : undefined) ||
    files?.find((f) => f.uri && (!f.mime || f.mime.startsWith("image/")))?.uri?.trim() ||
    files?.[0]?.uri?.trim();

  const image = normalizeImageUrl(rawImage);

  return {
    symbol: symRaw || undefined,
    image: image || undefined,
  };
}

export async function fetchHeliusTokenMeta(mint: string): Promise<HeliusTokenMeta | null> {
  const keys = parseHeliusApiKeys();
  if (keys.length === 0) return null;

  let lastError: unknown;
  for (const key of keys) {
    try {
      return await fetchHeliusAsset(mint, key);
    } catch (e) {
      lastError = e;
      const message = e instanceof Error ? e.message : String(e);
      if (!isRpcFallbackError(message)) return null;
    }
  }
  console.warn("[helius token meta] all keys failed:", lastError);
  return null;
}
