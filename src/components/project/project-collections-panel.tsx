"use client";

import { useMemo, useState } from "react";

import { SiteSelect } from "@/components/ui/site-select";
import { MarketplaceLogoLink } from "@/components/project/marketplace-link-chip";
import type { CollectionLink, ProjectCollection } from "@/lib/project-collections";
import { collectionDisplayName } from "@/lib/project-collections";
import type { LiveMeStats } from "@/lib/magiceden-stats";

function listingsStatValue(listings: string, totalSupply: string | null): string {
  const listed = Number(String(listings).replace(/,/g, ""));
  const total =
    totalSupply != null && String(totalSupply).trim() !== ""
      ? Number(String(totalSupply).replace(/,/g, ""))
      : NaN;
  if (!Number.isFinite(listed) || !Number.isFinite(total) || total <= 0) {
    return listings;
  }
  const pct = (listed / total) * 100;
  return `${listings} (${String(parseFloat(pct.toFixed(2)))}%)`;
}

function StatsGrid({ live }: { live: LiveMeStats }) {
  const statRows: { label: string; value: string }[] = [];
  if (live.ok) {
    if (live.floorSol) statRows.push({ label: "Floor", value: `${live.floorSol} SOL` });
    if (live.supply) statRows.push({ label: "Total supply", value: live.supply });
    if (live.listings) {
      statRows.push({
        label: "Listings",
        value: listingsStatValue(live.listings, live.supply),
      });
    }
    if (live.volumeSol) statRows.push({ label: "Volume (all-time)", value: `${live.volumeSol} SOL` });
    if (live.avg24hSol) statRows.push({ label: "24h avg sale", value: `${live.avg24hSol} SOL` });
  }

  if (live.ok && statRows.length > 0) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {statRows.map((row) => (
          <div
            key={row.label}
            className="rounded-xl border border-border bg-surface/50 px-3 py-3 text-sm"
          >
            <div className="text-xs uppercase tracking-wide text-muted">{row.label}</div>
            <div className="mt-1 font-semibold tabular-nums text-accent-gold">{row.value}</div>
          </div>
        ))}
      </div>
    );
  }

  if (live.message) {
    return (
      <div className="rounded-xl border border-border bg-surface/40 px-4 py-3 text-sm text-muted">
        {live.message}
      </div>
    );
  }

  return null;
}

export function ProjectCollectionsPanel({
  collections,
  statsByIndex,
}: {
  collections: ProjectCollection[];
  statsByIndex: LiveMeStats[];
}) {
  const options = useMemo(
    () =>
      collections.map((c, i) => ({
        index: i,
        label: collectionDisplayName(c, i),
      })),
    [collections],
  );

  const [selected, setSelected] = useState(0);
  const safeIndex = selected < collections.length ? selected : 0;
  const collection = collections[safeIndex];
  const live = statsByIndex[safeIndex] ?? {
    ok: false,
    message: null,
    symbol: null,
    floorSol: null,
    listings: null,
    volumeSol: null,
    avg24hSol: null,
    supply: null,
  };

  const links = collection?.links ?? [];

  if (collections.length === 0) return null;

  return (
    <div className="space-y-4">
      {collections.length > 1 ? (
        <label className="flex max-w-md flex-col gap-2 text-xs text-muted">
          Collection
          <SiteSelect
            value={safeIndex}
            onChange={(e) => setSelected(Number(e.target.value))}
          >
            {options.map((o) => (
              <option key={o.index} value={o.index}>
                {o.label}
              </option>
            ))}
          </SiteSelect>
        </label>
      ) : null}

      {links.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {links.map((link: CollectionLink) => (
            <MarketplaceLogoLink
              key={`${link.marketplace}-${link.href}`}
              href={link.href}
              marketplace={link.marketplace}
            />
          ))}
        </div>
      ) : null}

      <StatsGrid live={live} />
    </div>
  );
}
