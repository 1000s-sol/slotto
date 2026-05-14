import Link from "next/link";
import { notFound } from "next/navigation";

import { fetchLiveMagicEdenStats, magicEdenCollectionUrls } from "@/lib/magiceden-stats";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ slug: string }> };

type MpRow = { label: string; href: string };

function asMarketplaces(raw: unknown): MpRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is MpRow =>
      !!x &&
      typeof x === "object" &&
      typeof (x as MpRow).label === "string" &&
      typeof (x as MpRow).href === "string",
  );
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = await prisma.project.findFirst({
    where: { slug, published: true },
  });
  if (!project) notFound();

  const marketplaces = asMarketplaces(project.marketplaces);
  const meCollectionUrls = magicEdenCollectionUrls(project.meUrls, project.meUrl);
  const live = await fetchLiveMagicEdenStats(meCollectionUrls[0] ?? null, 120);

  const statRows: { label: string; value: string }[] = [];
  if (live.ok) {
    if (live.floorSol) statRows.push({ label: "Floor", value: `${live.floorSol} SOL` });
    if (live.supply) statRows.push({ label: "Supply", value: live.supply });
    if (live.listings) statRows.push({ label: "Listings", value: live.listings });
    if (live.volumeSol) statRows.push({ label: "Volume (all-time)", value: `${live.volumeSol} SOL` });
    if (live.avg24hSol) statRows.push({ label: "24h avg sale", value: `${live.avg24hSol} SOL` });
  }

  return (
    <div className="space-y-6">
      <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
        ← Back to projects
      </Link>

      <div className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/80">
        {project.bannerImageUrl ? (
          <div className="relative h-44 w-full sm:h-52">
            <img
              src={project.bannerImageUrl}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-elevated via-transparent to-transparent" />
          </div>
        ) : (
          <div className="h-40 bg-gradient-to-r from-accent-purple/30 via-surface to-accent-blue/30" />
        )}
        <div className="space-y-6 px-6 pb-8 pt-6 sm:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
              {meCollectionUrls.length > 0 ? (
                <div className="mt-2 space-y-1 text-sm text-muted">
                  <p className="text-[11px] uppercase tracking-wide text-muted/80">Magic Eden</p>
                  <ul className="list-inside list-disc space-y-0.5">
                    {meCollectionUrls.map((url, i) => (
                      <li key={`${url}-${i}`} className="marker:text-muted/50">
                        {i === 0 ? (
                          <span className="text-[11px] text-muted/70">Primary (stats) · </span>
                        ) : null}
                        <a className="text-accent-cyan hover:underline" href={url}>
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {project.websiteUrl ? (
                <a
                  href={project.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:border-accent-purple/40 hover:text-foreground"
                >
                  Website
                </a>
              ) : null}
              {project.discordUrl ? (
                <a
                  href={project.discordUrl}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:border-accent-purple/40 hover:text-foreground"
                >
                  Discord
                </a>
              ) : null}
              {project.twitterUrl ? (
                <a
                  href={project.twitterUrl}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:border-accent-purple/40 hover:text-foreground"
                >
                  X
                </a>
              ) : null}
            </div>
          </div>

          {live.ok && statRows.length > 0 ? (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted/90">
                Live stats ·{" "}
                {live.symbol ? (
                  <a
                    href={`https://magiceden.io/marketplace/${encodeURIComponent(live.symbol)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-cyan hover:underline"
                  >
                    {live.symbol}
                  </a>
                ) : (
                  <a
                    href="https://magiceden.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-cyan hover:underline"
                  >
                    Magic Eden
                  </a>
                )}{" "}
                · cached ~2 min
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {statRows.map((row) => (
                  <div key={row.label} className="rounded-xl border border-border bg-surface/50 px-3 py-3 text-sm">
                    <div className="text-xs uppercase tracking-wide text-muted">{row.label}</div>
                    <div className="mt-1 font-semibold text-foreground">{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : live.message ? (
            <div className="rounded-xl border border-border bg-surface/40 px-4 py-3 text-sm text-muted">
              {live.message}
            </div>
          ) : null}

          {project.tokenMint ? (
            <div className="rounded-xl border border-border bg-surface/40 p-4 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted">Project token</div>
              <div className="mt-1 break-all font-mono text-xs text-foreground">{project.tokenMint}</div>
            </div>
          ) : null}

          {marketplaces.length > 0 ? (
            <div>
              <h2 className="text-lg font-semibold">Marketplaces</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {marketplaces.map((m) => (
                  <li key={m.href}>
                    <a className="text-accent-cyan hover:underline" href={m.href}>
                      {m.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <article className="prose prose-invert max-w-none prose-headings:scroll-mt-24 prose-p:text-muted prose-li:text-muted">
            <pre className="whitespace-pre-wrap rounded-xl border border-border bg-bg-deep/60 p-4 font-sans text-sm leading-relaxed text-muted">
              {project.reviewMd}
            </pre>
          </article>
        </div>
      </div>
    </div>
  );
}
