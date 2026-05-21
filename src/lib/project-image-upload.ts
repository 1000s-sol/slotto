import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

/** Max upload size (bytes) */
const MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL);
}

function blobReadWriteToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim();
}

function blobStoreId(): string | undefined {
  return process.env.BLOB_STORE_ID?.trim();
}

/** Use Blob on Vercel or whenever credentials exist. */
function useBlobStorage(): boolean {
  return (
    isVercelRuntime() ||
    Boolean(blobReadWriteToken()) ||
    Boolean(blobStoreId())
  );
}

const BLOB_SETUP_HINT =
  "Connect a Vercel Blob store to this project, then redeploy. Env vars from Settings only apply to new deployments — a browser refresh is not enough.";

/**
 * True for images we saved ourselves (local uploads dir or this app's Vercel Blob prefix), so replace/delete is safe.
 */
export function isProjectUploadPath(url: string | null | undefined): boolean {
  if (!url || url.includes("..")) return false;
  if (url.startsWith("/uploads/projects/")) return true;
  if (!url.startsWith("https://")) return false;
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith(".blob.vercel-storage.com")) return false;
    const p = decodeURIComponent(u.pathname);
    return p.startsWith("/projects/");
  } catch {
    return false;
  }
}

function uploadAbsolutePath(relativeFromPublic: string): string {
  return path.join(process.cwd(), "public", relativeFromPublic);
}

function blobPutOptions(mime: string, ext: string) {
  const opts: Parameters<typeof put>[2] = {
    access: "public",
    contentType: mime || `image/${ext}`,
    addRandomSuffix: false,
  };
  const token = blobReadWriteToken();
  if (token) {
    opts.token = token;
  }
  return opts;
}

/** Save an uploaded image. Returns a public URL (absolute HTTPS on Blob, or /uploads/projects/… on disk). */
export async function saveProjectImageFile(file: File): Promise<string> {
  const mime = (file.type || "").toLowerCase().trim();
  const ext = ALLOWED.get(mime);
  if (!ext) {
    throw new Error(`Unsupported image type "${mime || "unknown"}". Use PNG, JPEG, WebP, or GIF.`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`Image is too large (max ${MAX_BYTES / (1024 * 1024)} MB).`);
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) {
    throw new Error("Empty file.");
  }

  const name = `${randomUUID()}.${ext}`;

  if (useBlobStorage()) {
    const pathname = `projects/${name}`;
    try {
      const { url } = await put(pathname, buf, blobPutOptions(mime, ext));
      return url;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`${BLOB_SETUP_HINT} (${detail})`);
    }
  }

  const dir = uploadAbsolutePath(path.join("uploads", "projects"));
  await mkdir(dir, { recursive: true });
  const rel = path.join("uploads", "projects", name).split(path.sep).join("/");
  const dest = path.join(dir, name);
  await writeFile(dest, buf);
  return `/${rel}`;
}

export async function deleteProjectUploadFile(publicPath: string | null | undefined): Promise<void> {
  if (!publicPath || !isProjectUploadPath(publicPath)) return;

  if (publicPath.startsWith("/uploads/projects/")) {
    const abs = uploadAbsolutePath(publicPath.replace(/^\//, ""));
    try {
      await unlink(abs);
    } catch {
      /* already gone */
    }
    return;
  }

  if (publicPath.startsWith("https://")) {
    try {
      const token = blobReadWriteToken();
      await del(publicPath, token ? { token } : undefined);
    } catch {
      /* already gone or missing credentials locally */
    }
  }
}
