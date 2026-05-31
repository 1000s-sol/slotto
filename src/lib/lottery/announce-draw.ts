import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/project-share-meta";

import { formatSolFromLamports } from "./draws";
import { postTweet, xPostingConfigured } from "@/lib/x/post-tweet";

type AnnouncementKind = "LIVE" | "ENDED";

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

/**
 * Claim the (drawId, kind) slot, then post. The unique claim is taken BEFORE
 * posting so concurrent callers (multiple browsers triggering settlement) can
 * never double-post. If the post fails we release the claim so a later crank
 * can retry.
 */
async function claimAndPost(
  onChainDrawId: number,
  kind: AnnouncementKind,
  text: string,
): Promise<void> {
  if (!xPostingConfigured()) return;

  const where = { onChainDrawId_kind: { onChainDrawId, kind } };

  try {
    await prisma.lotteryDrawAnnouncement.create({
      data: { onChainDrawId, kind },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return; // already posted or claimed elsewhere
    console.warn("[lottery announce] claim failed:", e);
    return;
  }

  try {
    const res = await postTweet(text);
    await prisma.lotteryDrawAnnouncement.update({
      where,
      data: { tweetId: res?.id ?? null },
    });
  } catch (e) {
    console.warn("[lottery announce] post failed, releasing claim:", e);
    await prisma.lotteryDrawAnnouncement.delete({ where }).catch(() => {});
    throw e;
  }
}

function shortWallet(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

function formatCloseDate(salesCloseTs?: number): string | null {
  if (!salesCloseTs || !Number.isFinite(salesCloseTs)) return null;
  return new Date(salesCloseTs * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

/** Official post when a new draw is created / opens for sales. */
export async function announceDrawLive(opts: {
  drawId: number;
  seedLamports?: number;
  salesCloseTs?: number;
}): Promise<void> {
  if (!xPostingConfigured()) return;

  const siteUrl = getSiteUrl();
  const lines = [`🎰 Slotto draw #${opts.drawId} is LIVE!`];
  if (opts.seedLamports && opts.seedLamports > 0) {
    lines.push(`Seed jackpot: ${formatSolFromLamports(opts.seedLamports)} SOL`);
  }
  const closeDate = formatCloseDate(opts.salesCloseTs);
  if (closeDate) lines.push(`Sales close ${closeDate}`);
  lines.push("Grab your tickets 👇");
  lines.push(siteUrl);

  await claimAndPost(opts.drawId, "LIVE", lines.join("\n"));
}

/** Official post when a draw settles (winner paid) or refunds (no sales). */
export async function announceDrawEnded(opts: {
  drawId: number;
  winner: string | null;
  prizeLamports?: number;
  totalTickets: number;
  refunded: boolean;
}): Promise<void> {
  if (!xPostingConfigured()) return;

  const siteUrl = getSiteUrl();
  let text: string;

  if (opts.refunded || !opts.winner) {
    text = [
      `Slotto draw #${opts.drawId} closed with no tickets sold — the seed rolls into the next draw.`,
      "New draw soon 👇",
      siteUrl,
    ].join("\n");
  } else {
    const lines = [`🏆 Slotto draw #${opts.drawId} settled!`];
    lines.push(`Winner: ${shortWallet(opts.winner)}`);
    if (opts.prizeLamports && opts.prizeLamports > 0) {
      lines.push(`Prize: ${formatSolFromLamports(opts.prizeLamports)} SOL`);
    }
    lines.push("Next draw soon — play 👇");
    lines.push(siteUrl);
    text = lines.join("\n");
  }

  await claimAndPost(opts.drawId, "ENDED", text);
}
