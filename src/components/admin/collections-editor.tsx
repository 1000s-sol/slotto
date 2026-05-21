"use client";

import { useEffect, useState } from "react";

import {
  MARKETPLACE_IDS,
  MARKETPLACE_LABEL,
  type MarketplaceId,
} from "@/lib/marketplace-icons";
import type { ProjectCollection } from "@/lib/project-collections";

function emptyCollection(): ProjectCollection {
  return { name: "", links: [{ marketplace: "magicEden", href: "" }] };
}

function emptyLink(): { marketplace: MarketplaceId; href: string } {
  return { marketplace: "magicEden", href: "" };
}

export function CollectionsEditor({ initialCollections }: { initialCollections: ProjectCollection[] }) {
  const [collections, setCollections] = useState<ProjectCollection[]>(() =>
    initialCollections.length ? initialCollections.map((c) => ({ ...c, links: c.links.map((l) => ({ ...l })) })) : [emptyCollection()],
  );

  useEffect(() => {
    const next =
      initialCollections.length > 0
        ? initialCollections.map((c) => ({ ...c, links: c.links.map((l) => ({ ...l })) }))
        : [emptyCollection()];
    setCollections(next);
  }, [JSON.stringify(initialCollections)]);

  const collectionsJson = JSON.stringify(
    collections
      .map((c) => ({
        name: c.name.trim(),
        links: c.links.filter((l) => l.href.trim()),
      }))
      .filter((c) => c.links.length > 0),
  );

  function updateCollection(index: number, patch: Partial<ProjectCollection>) {
    setCollections((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function updateLink(collIndex: number, linkIndex: number, patch: Partial<{ marketplace: MarketplaceId; href: string }>) {
    setCollections((prev) =>
      prev.map((c, i) =>
        i === collIndex
          ? {
              ...c,
              links: c.links.map((l, j) => (j === linkIndex ? { ...l, ...patch } : l)),
            }
          : c,
      ),
    );
  }

  function addLink(collIndex: number) {
    setCollections((prev) =>
      prev.map((c, i) => {
        if (i !== collIndex) return c;
        const used = new Set(c.links.map((l) => l.marketplace));
        const nextId = MARKETPLACE_IDS.find((id) => !used.has(id)) ?? "magicEden";
        return { ...c, links: [...c.links, { marketplace: nextId, href: "" }] };
      }),
    );
  }

  function removeLink(collIndex: number, linkIndex: number) {
    setCollections((prev) =>
      prev.map((c, i) => {
        if (i !== collIndex) return c;
        const next = c.links.filter((_, j) => j !== linkIndex);
        return { ...c, links: next.length ? next : [emptyLink()] };
      }),
    );
  }

  return (
    <div className="space-y-6">
      <input type="hidden" name="collectionsJson" value={collectionsJson} readOnly />
      <div>
        <h3 className="text-sm font-semibold text-foreground">Marketplace URLs</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Each <strong className="text-muted">collection</strong> is a group of marketplace links visitors can switch
          between. The <strong className="text-muted">primary collection</strong> (first) must include Magic Eden —
          live floor and volume use that collection&apos;s Magic Eden URL. Add Tensor, Gravemarket, or Orbis links per
          collection as needed.
        </p>
      </div>

      {collections.map((coll, collIndex) => (
        <div
          key={collIndex}
          className="space-y-4 rounded-2xl border border-border bg-surface/25 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
              {collIndex === 0 ? "Primary collection" : `Collection ${collIndex + 1}`}
            </h4>
            {collIndex > 0 ? (
              <button
                type="button"
                className="text-xs font-medium text-red-300 hover:underline"
                onClick={() => setCollections((prev) => prev.filter((_, i) => i !== collIndex))}
              >
                Remove collection
              </button>
            ) : null}
          </div>

          <label className="flex flex-col gap-2 text-xs text-muted">
            Collection name (optional — shown in dropdown on public page)
            <input
              type="text"
              value={coll.name}
              onChange={(e) => updateCollection(collIndex, { name: e.target.value })}
              placeholder={collIndex === 0 ? "e.g. Main collection" : "e.g. Bots"}
              className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
            />
          </label>

          <div className="space-y-3">
            {coll.links.map((link, linkIndex) => (
              <div
                key={linkIndex}
                className="grid gap-3 sm:grid-cols-[minmax(8rem,10rem)_1fr_auto] sm:items-end"
              >
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Marketplace
                  <select
                    value={link.marketplace}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (MARKETPLACE_IDS.includes(v as MarketplaceId)) {
                        updateLink(collIndex, linkIndex, { marketplace: v as MarketplaceId });
                      }
                    }}
                    className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
                  >
                    {MARKETPLACE_IDS.map((id) => (
                      <option key={id} value={id}>
                        {MARKETPLACE_LABEL[id]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-xs text-muted">
                  URL
                  <input
                    type="text"
                    inputMode="url"
                    value={link.href}
                    onChange={(e) => updateLink(collIndex, linkIndex, { href: e.target.value })}
                    placeholder="https://…"
                    className="rounded-xl border border-border bg-surface/60 px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15 sm:text-sm"
                  />
                </label>
                <button
                  type="button"
                  className="rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted transition hover:border-red-500/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={collIndex === 0 && link.marketplace === "magicEden" && coll.links.length <= 1}
                  onClick={() => removeLink(collIndex, linkIndex)}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-xs font-medium text-accent-cyan hover:underline disabled:opacity-40"
              disabled={coll.links.length >= MARKETPLACE_IDS.length}
              onClick={() => addLink(collIndex)}
            >
              + Add marketplace link
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="text-xs font-medium text-accent-cyan hover:underline"
        onClick={() => setCollections((p) => [...p, emptyCollection()])}
      >
        + Add another collection
      </button>
    </div>
  );
}
