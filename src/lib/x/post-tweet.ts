import { createHmac, randomBytes } from "node:crypto";

/**
 * Minimal X (Twitter) API v2 posting for the official @slottogg_ account.
 *
 * Uses OAuth 1.0a user-context signing (App key/secret + Access token/secret)
 * because we post as a single fixed account — no per-user OAuth flow needed.
 * Everything is gated behind SLOTTO_X_POSTING_ENABLED so it is a safe no-op
 * until credentials are configured.
 */

const TWEETS_ENDPOINT = "https://api.twitter.com/2/tweets";
const UPLOAD_ENDPOINT = "https://upload.twitter.com/1.1/media/upload.json";
const CHUNK_BYTES = 1024 * 1024;

type XCreds = {
  appKey: string;
  appSecret: string;
  accessToken: string;
  accessSecret: string;
};

type MediaUploadJson = {
  media_id_string?: string;
  processing_info?: {
    state: "pending" | "in_progress" | "failed" | "succeeded";
    check_after_secs?: number;
    error?: { message?: string };
  };
};

function readCreds(): XCreds | null {
  const appKey = process.env.SLOTTO_X_APP_KEY?.trim();
  const appSecret = process.env.SLOTTO_X_APP_SECRET?.trim();
  const accessToken = process.env.SLOTTO_X_ACCESS_TOKEN?.trim();
  const accessSecret = process.env.SLOTTO_X_ACCESS_SECRET?.trim();
  if (!appKey || !appSecret || !accessToken || !accessSecret) return null;
  return { appKey, appSecret, accessToken, accessSecret };
}

function postingEnabled(): boolean {
  return process.env.SLOTTO_X_POSTING_ENABLED?.trim().toLowerCase() === "true";
}

/** True when official-account posting is switched on and fully configured. */
export function xPostingConfigured(): boolean {
  return postingEnabled() && readCreds() !== null;
}

/** RFC 3986 percent-encoding (stricter than encodeURIComponent). */
function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function oauthHeader(
  creds: XCreds,
  method: string,
  url: string,
  extraParams?: Record<string, string>,
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.appKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };

  const signParams: Record<string, string> = {
    ...oauthParams,
    ...extraParams,
  };
  const paramString = Object.keys(signParams)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(signParams[k])}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    rfc3986(url),
    rfc3986(paramString),
  ].join("&");

  const signingKey = `${rfc3986(creds.appSecret)}&${rfc3986(creds.accessSecret)}`;
  const signature = createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  const headerParams: Record<string, string> = {
    ...oauthParams,
    oauth_signature: signature,
  };
  const header = Object.keys(headerParams)
    .sort()
    .map((k) => `${rfc3986(k)}="${rfc3986(headerParams[k])}"`)
    .join(", ");

  return `OAuth ${header}`;
}

async function formCommand(
  creds: XCreds,
  params: Record<string, string>,
): Promise<MediaUploadJson> {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(UPLOAD_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: oauthHeader(creds, "POST", UPLOAD_ENDPOINT, params),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `X media ${params.command} failed (${res.status}): ${detail.slice(0, 300)}`,
    );
  }
  return (await res.json()) as MediaUploadJson;
}

async function appendChunk(
  creds: XCreds,
  mediaId: string,
  segmentIndex: number,
  chunk: Uint8Array,
  filename: string,
  mime: string,
): Promise<void> {
  const form = new FormData();
  form.append("command", "APPEND");
  form.append("media_id", mediaId);
  form.append("segment_index", String(segmentIndex));
  form.append("media", new Blob([chunk], { type: mime }), filename);

  const res = await fetch(UPLOAD_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: oauthHeader(creds, "POST", UPLOAD_ENDPOINT),
    },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `X media APPEND failed (${res.status}): ${detail.slice(0, 300)}`,
    );
  }
}

async function waitUntilProcessed(
  creds: XCreds,
  mediaId: string,
  initial?: MediaUploadJson["processing_info"],
): Promise<void> {
  let info = initial;
  for (let i = 0; i < 20; i += 1) {
    if (!info || info.state === "succeeded") return;
    if (info.state === "failed") {
      throw new Error(info.error?.message || "X media processing failed");
    }
    const waitSec = Math.max(1, info.check_after_secs ?? 1);
    await new Promise((r) => setTimeout(r, waitSec * 1000));

    const params = { command: "STATUS", media_id: mediaId };
    const res = await fetch(
      `${UPLOAD_ENDPOINT}?${new URLSearchParams(params).toString()}`,
      {
        headers: {
          Authorization: oauthHeader(creds, "GET", UPLOAD_ENDPOINT, params),
        },
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `X media STATUS failed (${res.status}): ${detail.slice(0, 300)}`,
      );
    }
    info = ((await res.json()) as MediaUploadJson).processing_info;
  }
  throw new Error("X media processing timed out");
}

function mediaCategory(mime: string): string {
  return mime === "image/gif" ? "tweet_gif" : "tweet_image";
}

/**
 * Chunked upload for a tweet image/GIF. Returns media_id_string, or null when
 * posting is disabled. Throws on an actual API failure.
 */
export async function uploadTweetMedia(opts: {
  bytes: Uint8Array;
  mime: string;
  filename: string;
}): Promise<string | null> {
  const creds = readCreds();
  if (!postingEnabled() || !creds) return null;

  const init = await formCommand(creds, {
    command: "INIT",
    total_bytes: String(opts.bytes.byteLength),
    media_type: opts.mime,
    media_category: mediaCategory(opts.mime),
  });
  const mediaId = init.media_id_string;
  if (!mediaId) throw new Error("X media INIT returned no media id");

  for (
    let offset = 0, segment = 0;
    offset < opts.bytes.byteLength;
    offset += CHUNK_BYTES, segment += 1
  ) {
    await appendChunk(
      creds,
      mediaId,
      segment,
      opts.bytes.subarray(offset, offset + CHUNK_BYTES),
      opts.filename,
      opts.mime,
    );
  }

  const finalized = await formCommand(creds, {
    command: "FINALIZE",
    media_id: mediaId,
  });
  await waitUntilProcessed(creds, mediaId, finalized.processing_info);
  return mediaId;
}

export type PostTweetOpts = {
  mediaIds?: string[];
};

/**
 * Post a tweet as the official account. Returns the tweet id, or null when
 * posting is disabled/unconfigured. Throws only on an actual API failure.
 */
export async function postTweet(
  text: string,
  opts?: PostTweetOpts,
): Promise<{ id: string } | null> {
  const creds = readCreds();
  if (!postingEnabled() || !creds) {
    return null;
  }

  const body: {
    text: string;
    media?: { media_ids: string[] };
  } = { text };
  if (opts?.mediaIds && opts.mediaIds.length > 0) {
    body.media = { media_ids: opts.mediaIds };
  }

  const res = await fetch(TWEETS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: oauthHeader(creds, "POST", TWEETS_ENDPOINT),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`X post failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const json = (await res.json()) as { data?: { id?: string } };
  const id = json.data?.id;
  if (!id) throw new Error("X post succeeded but returned no tweet id");
  return { id };
}
