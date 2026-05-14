/** Many token images are ipfs:// — img src needs https gateway */
export function normalizeImageUrl(url: string | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;
  if (u.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${u.slice(7)}`;
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
  return u;
}

export type HeliusTokenMeta = { symbol?: string; image?: string };

export async function fetchHeliusTokenMeta(mint: string): Promise<HeliusTokenMeta | null> {
  const key = process.env.HELIUS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${key}`, {
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
    if (!res.ok) return null;
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
  } catch {
    return null;
  }
}
