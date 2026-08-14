import { NextResponse } from "next/server";

import { lotteryProgramId } from "@/lib/lottery/config";
import {
  formatDrawDisplayLabel,
  getDrawDisplayMetaMap,
  listProductionOnChainDrawIds,
} from "@/lib/lottery/draw-display-db";
import { getDrawPaidWithFromDb } from "@/lib/lottery/draw-paid-with-db";
import { withLotteryServerRpc } from "@/lib/lottery/server-rpc";
import { fetchLinkedWalletDrawTickets } from "@/lib/lottery/wallet-tickets";
import { readProfileSessionCookie } from "@/lib/profile-session";
import { getProfilePublic } from "@/lib/user-profile-db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Past public-draw tickets for the logged-in profile's linked wallets. */
export async function GET(request: Request) {
  const limit = rateLimit(`profile-tickets:${clientIp(request)}`, 30, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests", rows: [] },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const profileId = await readProfileSessionCookie();
  if (!profileId) {
    return NextResponse.json({ rows: [], wallets: [] });
  }
  const profile = await getProfilePublic(profileId);
  const wallets = profile?.wallets ?? [];
  if (wallets.length === 0) {
    return NextResponse.json({ rows: [], wallets: [] });
  }

  try {
    const productionIds = await listProductionOnChainDrawIds();
    if (productionIds.length === 0) {
      return NextResponse.json({ rows: [], wallets });
    }

    const rows = await withLotteryServerRpc(async (connection) => {
      const raw = await fetchLinkedWalletDrawTickets(
        connection,
        lotteryProgramId(),
        wallets,
        { drawIds: productionIds },
      );
      const metaMap = await getDrawDisplayMetaMap(raw.map((r) => r.drawId));

      const paidByDraw = new Map<number, string[]>();
      await Promise.all(
        raw.map(async (r) => {
          const byWallet = await getDrawPaidWithFromDb(r.drawId);
          const mints = new Set<string>();
          for (const w of wallets) {
            for (const m of byWallet[w] ?? []) mints.add(m);
          }
          paidByDraw.set(r.drawId, [...mints]);
        }),
      );

      return raw
        .sort(
          (a, b) =>
            (metaMap.get(b.drawId)?.displayNumber ?? 0) -
            (metaMap.get(a.drawId)?.displayNumber ?? 0),
        )
        .map((r) => {
          const meta = metaMap.get(r.drawId);
          return {
            ...r,
            displayLabel: meta ? formatDrawDisplayLabel(meta) : `#${r.drawId}`,
            paidWithMints: paidByDraw.get(r.drawId) ?? [],
          };
        });
    });

    return NextResponse.json({ rows, wallets });
  } catch (e) {
    const message = e instanceof Error ? e.message : "tickets failed";
    return NextResponse.json({ error: message, rows: [] }, { status: 500 });
  }
}
