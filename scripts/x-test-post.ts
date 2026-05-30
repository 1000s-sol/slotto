/**
 * Verify the official @slottogg_ X posting credentials with a one-off tweet.
 * Bypasses the DB idempotency table — purely tests OAuth 1.0a signing + write
 * permission.
 *
 * Usage:
 *   npm run x:test-post                 # posts a timestamped test tweet
 *   npm run x:test-post -- "custom text"
 */
import "dotenv/config";

import { postTweet, xPostingConfigured } from "../src/lib/x/post-tweet";

async function main() {
  if (!xPostingConfigured()) {
    console.error(
      "X posting is not configured. Check SLOTTO_X_POSTING_ENABLED=true and the four SLOTTO_X_* keys in .env.",
    );
    process.exit(1);
  }

  const text =
    process.argv.slice(2).join(" ").trim() ||
    `Slotto posting test — ${new Date().toISOString()} ✅`;

  console.log("Posting:", JSON.stringify(text));
  try {
    const res = await postTweet(text);
    console.log("Success. Tweet id:", res?.id);
    console.log("View: https://x.com/slottogg_/status/" + res?.id);
  } catch (e) {
    console.error("Post failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

void main();
