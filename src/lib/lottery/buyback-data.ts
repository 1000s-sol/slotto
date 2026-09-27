import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

import { prisma } from "@/lib/prisma";
import {
  resolveTokenDisplays,
  type ProjectDisplayHints,
} from "@/lib/token-display-cache";
import {
  fetchDexTokenRows,
  fetchJupiterUsd,
  resolveTokenUsdPrice,
  WRAPPED_SOL_MINT,
} from "@/lib/token-usd-prices";

import { lotteryProgramId } from "./config";
import { fetchAllDraws } from "./draws";
import {
  formatDrawDisplayLabel,
  getDrawDisplayMetaMap,
} from "./draw-display-db";
import { isFreeEntryMint } from "./free-entry";
import { LOTTERY_TEAM_VAULT } from "./recipients";
import { withLotteryServerRpc } from "./server-rpc";

export const BUYBACK_RATE = 0.9;

export type BuybackDrawBreakdown = {
  onChainDrawId: number;
  displayLabel: string;
  /** YYYY-MM-DD (UTC) from sales close. */
  salesCloseDate: string;
  ticketsSold: number;
};

export type BuybackTokenRow = {
  mint: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  projectSlug: string | null;
  totalTicketsSold: number;
  tokensHeld: number;
  tokensHeldRaw: string;
  decimals: number;
  tokenUsd: number | null;
  solUsd: number | null;
  valueUsd: number | null;
  valueSol: number | null;
  buybackUsd: number | null;
  buybackSol: number | null;
  savingUsd: number | null;
  savingSol: number | null;
  draws: BuybackDrawBreakdown[];
};

export type BuybackSnapshot = {
  teamVault: string;
  solUsd: number | null;
  updatedAt: string;
  tokens: BuybackTokenRow[];
};

function abbrevMint(mint: string): string {
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

function formatCloseDate(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function uiAmount(raw: string, decimals: number): number {
  try {
    const n = BigInt(raw);
    if (decimals <= 0) return Number(n);
    const base = BigInt(10) ** BigInt(decimals);
    const whole = n / base;
    const frac = n % base;
    return Number(whole) + Number(frac) / Number(base);
  } catch {
    return 0;
  }
}

type VaultMintBalance = { totalAmount: string; decimals: number };

/**
 * One/two RPC calls for the whole vault (TOKEN + Token-2022) instead of
 * per-mint lookups that rate-limit to zeros under load.
 */
async function fetchVaultBalancesByMint(
  owner: PublicKey,
): Promise<Map<string, VaultMintBalance>> {
  return withLotteryServerRpc(async (connection) => {
    const out = new Map<string, { total: bigint; decimals: number }>();

    for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
      const parsed = await connection.getParsedTokenAccountsByOwner(
        owner,
        { programId },
        "confirmed",
      );
      for (const { account } of parsed.value) {
        const info = account.data.parsed?.info as
          | {
              mint?: string;
              tokenAmount?: { amount?: string; decimals?: number };
            }
          | undefined;
        const mint = info?.mint?.trim();
        const amountStr = info?.tokenAmount?.amount;
        if (!mint || !amountStr) continue;
        let amount: bigint;
        try {
          amount = BigInt(amountStr);
        } catch {
          continue;
        }
        if (amount === BigInt(0)) continue;
        const decimals = info.tokenAmount?.decimals ?? 0;
        const prev = out.get(mint);
        if (prev) {
          prev.total += amount;
          prev.decimals = decimals;
        } else {
          out.set(mint, { total: amount, decimals });
        }
      }
    }

    const mapped = new Map<string, VaultMintBalance>();
    for (const [mint, row] of out) {
      mapped.set(mint, {
        totalAmount: row.total.toString(),
        decimals: row.decimals,
      });
    }
    return mapped;
  });
}

/**
 * Aggregate production-draw SPL ticket sales + team-vault holdings for buyback UI.
 */
export async function fetchBuybackSnapshot(): Promise<BuybackSnapshot> {
  const programId = lotteryProgramId();
  const teamVault = new PublicKey(LOTTERY_TEAM_VAULT);

  const draws = await withLotteryServerRpc((connection) =>
    fetchAllDraws(connection, programId),
  );
  const metaMap = await getDrawDisplayMetaMap(draws.map((d) => d.drawId));

  type Agg = {
    totalTicketsSold: number;
    draws: Map<number, BuybackDrawBreakdown>;
  };
  const byMint = new Map<string, Agg>();

  for (const draw of draws) {
    const meta = metaMap.get(draw.drawId);
    if (!meta || meta.kind !== "PRODUCTION") continue;
    const displayLabel = formatDrawDisplayLabel(meta);
    const salesCloseDate = formatCloseDate(draw.salesCloseTs);

    for (const row of draw.splMints) {
      if (isFreeEntryMint(row.mint)) continue;

      let agg = byMint.get(row.mint);
      if (!agg) {
        agg = { totalTicketsSold: 0, draws: new Map() };
        byMint.set(row.mint, agg);
      }

      const prev = agg.draws.get(draw.drawId);
      if (prev) {
        prev.ticketsSold += row.sold;
      } else {
        agg.draws.set(draw.drawId, {
          onChainDrawId: draw.drawId,
          displayLabel,
          salesCloseDate,
          ticketsSold: row.sold,
        });
      }
      agg.totalTicketsSold += row.sold;
    }
  }

  // Founders only care about tokens that actually sold tickets.
  const mints = [...byMint.entries()]
    .filter(([, agg]) => agg.totalTicketsSold > 0)
    .map(([mint]) => mint);

  if (mints.length === 0) {
    return {
      teamVault: LOTTERY_TEAM_VAULT,
      solUsd: null,
      updatedAt: new Date().toISOString(),
      tokens: [],
    };
  }

  const priceMints = [WRAPPED_SOL_MINT, ...mints];
  const [projects, balances, byMintDex, jupUsd] = await Promise.all([
    prisma.project.findMany({
      where: { tokenMint: { in: mints } },
      select: {
        slug: true,
        name: true,
        tokenMint: true,
        tokenName: true,
        tokenImageUrl: true,
        tokenLiquid: true,
      },
    }),
    fetchVaultBalancesByMint(teamVault),
    fetchDexTokenRows(priceMints),
    fetchJupiterUsd(priceMints),
  ]);

  const projectByMint = new Map(
    projects
      .filter((p) => p.tokenMint)
      .map((p) => [p.tokenMint!.trim(), p] as const),
  );

  const displayHints = new Map<string, ProjectDisplayHints>();
  for (const mint of mints) {
    const p = projectByMint.get(mint);
    if (!p) continue;
    displayHints.set(mint, {
      tokenName: p.tokenName,
      // tokenImageUrl only — never project listing/banner art
      tokenImageUrl: p.tokenImageUrl,
      liquid: p.tokenLiquid,
    });
  }

  const displays = await resolveTokenDisplays(mints, displayHints);

  const solUsd = resolveTokenUsdPrice(
    WRAPPED_SOL_MINT,
    byMintDex.get(WRAPPED_SOL_MINT),
    jupUsd[WRAPPED_SOL_MINT] ?? null,
  );

  const tokens: BuybackTokenRow[] = mints.map((mint) => {
    const agg = byMint.get(mint)!;
    const project = projectByMint.get(mint);
    const bal = balances.get(mint) ?? { totalAmount: "0", decimals: 0 };
    const tokensHeld = uiAmount(bal.totalAmount, bal.decimals);
    const dex = byMintDex.get(mint);
    const display = displays.get(mint);
    const tokenUsd = resolveTokenUsdPrice(mint, dex, jupUsd[mint] ?? null);

    let valueUsd: number | null = null;
    let valueSol: number | null = null;
    let buybackUsd: number | null = null;
    let buybackSol: number | null = null;
    let savingUsd: number | null = null;
    let savingSol: number | null = null;

    if (tokenUsd != null && Number.isFinite(tokenUsd)) {
      valueUsd = tokensHeld * tokenUsd;
      buybackUsd = valueUsd * BUYBACK_RATE;
      savingUsd = valueUsd * (1 - BUYBACK_RATE);
      if (solUsd != null && solUsd > 0) {
        valueSol = valueUsd / solUsd;
        buybackSol = buybackUsd / solUsd;
        savingSol = savingUsd / solUsd;
      }
    }

    const symbol = display?.symbol || abbrevMint(mint);
    const name =
      project?.name?.trim() ||
      dex?.baseToken?.name?.trim() ||
      symbol;
    const imageUrl = display?.imageUrl ?? null;

    const drawsSorted = [...agg.draws.values()].sort(
      (a, b) => b.onChainDrawId - a.onChainDrawId,
    );

    return {
      mint,
      name,
      symbol,
      imageUrl,
      projectSlug: project?.slug ?? null,
      totalTicketsSold: agg.totalTicketsSold,
      tokensHeld,
      tokensHeldRaw: bal.totalAmount,
      decimals: bal.decimals,
      tokenUsd,
      solUsd,
      valueUsd,
      valueSol,
      buybackUsd,
      buybackSol,
      savingUsd,
      savingSol,
      draws: drawsSorted,
    };
  });

  tokens.sort((a, b) => {
    if (b.totalTicketsSold !== a.totalTicketsSold) {
      return b.totalTicketsSold - a.totalTicketsSold;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return {
    teamVault: LOTTERY_TEAM_VAULT,
    solUsd,
    updatedAt: new Date().toISOString(),
    tokens,
  };
}
