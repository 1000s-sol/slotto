import type { Connection, PublicKey } from "@solana/web3.js";

import { notifyDiscordDrawLive } from "@/lib/discord-ticket-bot/post-draw-start";

export type AnnounceDrawLiveResult =
  | { ok: true; discordPosted: number }
  | { ok: false; reason: string; discordPosted?: number };

/** Discord (+ X in production) draw-live posts. Idempotent per draw. */
export async function announceDrawLiveChannels(
  drawId: number,
  opts?: { seedLamports?: number; salesCloseTs?: number },
): Promise<AnnounceDrawLiveResult> {
  let discordPosted = 0;
  let discordError: string | undefined;

  try {
    const { withLotteryServerRpc } = await import("@/lib/lottery/server-rpc");
    const postDiscordLive = () =>
      withLotteryServerRpc((connection) =>
        notifyDiscordDrawLive(connection, drawId, opts),
      );

    let discord = await postDiscordLive();
    if (discord.skipped && discord.reason === "already posted") {
      return { ok: true, discordPosted: 0 };
    }

    discordPosted = discord.posted;
    if (discord.skipped && discord.reason) {
      discordError = discord.reason;
    }
  } catch (e) {
    discordError = e instanceof Error ? e.message : "Discord post failed";
    console.warn("[lottery announce live] Discord failed:", e);
  }

  const { lotteryTestMode } = await import("@/lib/lottery/test-mode");
  if (lotteryTestMode()) {
    if (discordPosted > 0) {
      return { ok: true, discordPosted };
    }
    return {
      ok: false,
      reason: discordError ?? "Discord draw-live did not post",
      discordPosted: 0,
    };
  }

  const { xPostingConfigured } = await import("@/lib/x/post-tweet");
  if (!xPostingConfigured()) {
    if (discordPosted > 0) {
      return { ok: true, discordPosted };
    }
    return {
      ok: false,
      reason:
        discordError ??
        "X posting not configured on Vercel (set SLOTTO_X_POSTING_ENABLED=true and SLOTTO_X_* keys).",
      discordPosted,
    };
  }

  try {
    const { announceDrawLive } = await import("@/lib/lottery/announce-draw");
    await announceDrawLive({ drawId, ...opts });
    return { ok: true, discordPosted };
  } catch (e) {
    if (discordPosted > 0) {
      return { ok: true, discordPosted };
    }
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "X post failed",
      discordPosted,
    };
  }
}

/** Force-repost draw-live to Discord (admin manual). Clears idempotency first. */
export async function forceAnnounceDiscordDrawLive(
  drawId: number,
  opts?: { seedLamports?: number; salesCloseTs?: number },
): Promise<AnnounceDrawLiveResult> {
  const { releaseDiscordDrawEmbedClaim } = await import(
    "@/lib/lottery/discord-draw-embed-idempotency"
  );
  await releaseDiscordDrawEmbedClaim(drawId, "live");
  return announceDrawLiveChannels(drawId, opts);
}
