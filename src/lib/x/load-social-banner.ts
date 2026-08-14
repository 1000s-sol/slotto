import { readFile } from "node:fs/promises";
import path from "node:path";

import { getSiteUrl } from "@/lib/site-metadata";

const BANNER_MIME: Record<string, string> = {
  ".gif": "image/gif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/** Bytes for an X media upload (disk first, then the public CDN URL). */
export async function loadSocialBannerBytes(
  filename: string,
): Promise<{ bytes: Uint8Array; mime: string; filename: string } | null> {
  const mime = BANNER_MIME[path.extname(filename).toLowerCase()];
  if (!mime) return null;

  try {
    const buf = await readFile(
      path.join(process.cwd(), "public", "socials", filename),
    );
    if (buf.length > 0) return { bytes: buf, mime, filename };
  } catch {
    /* Vercel serverless often has no public/ on disk */
  }

  const base = getSiteUrl().replace(/\/$/, "") || "https://slotto.gg";
  const res = await fetch(`${base}/socials/${filename}`);
  if (!res.ok) return null;
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    mime,
    filename,
  };
}
