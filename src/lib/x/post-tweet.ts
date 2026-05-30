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

type XCreds = {
  appKey: string;
  appSecret: string;
  accessToken: string;
  accessSecret: string;
};

function readCreds(): XCreds | null {
  const appKey = process.env.SLOTTO_X_APP_KEY?.trim();
  const appSecret = process.env.SLOTTO_X_APP_SECRET?.trim();
  const accessToken = process.env.SLOTTO_X_ACCESS_TOKEN?.trim();
  const accessSecret = process.env.SLOTTO_X_ACCESS_SECRET?.trim();
  if (!appKey || !appSecret || !accessToken || !accessSecret) return null;
  return { appKey, appSecret, accessToken, accessSecret };
}

/** True when official-account posting is switched on and fully configured. */
export function xPostingConfigured(): boolean {
  if (process.env.SLOTTO_X_POSTING_ENABLED?.trim().toLowerCase() !== "true") {
    return false;
  }
  return readCreds() !== null;
}

/** RFC 3986 percent-encoding (stricter than encodeURIComponent). */
function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function oauthHeader(creds: XCreds, method: string, url: string): string {
  const params: Record<string, string> = {
    oauth_consumer_key: creds.appKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };

  // For application/json bodies, only the oauth_* params are signed.
  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(params[k])}`)
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
    ...params,
    oauth_signature: signature,
  };
  const header = Object.keys(headerParams)
    .sort()
    .map((k) => `${rfc3986(k)}="${rfc3986(headerParams[k])}"`)
    .join(", ");

  return `OAuth ${header}`;
}

/**
 * Post a tweet as the official account. Returns the tweet id, or null when
 * posting is disabled/unconfigured. Throws only on an actual API failure.
 */
export async function postTweet(text: string): Promise<{ id: string } | null> {
  const creds = readCreds();
  if (
    process.env.SLOTTO_X_POSTING_ENABLED?.trim().toLowerCase() !== "true" ||
    !creds
  ) {
    return null;
  }

  const res = await fetch(TWEETS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: oauthHeader(creds, "POST", TWEETS_ENDPOINT),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
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
