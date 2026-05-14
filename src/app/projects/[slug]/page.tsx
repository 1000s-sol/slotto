import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectDetailActions } from "@/components/project/project-detail-actions";
import { ProjectMeLinks } from "@/components/project/project-me-links";
import { ProjectTokenBlock } from "@/components/project/project-token-block";
import { fetchLiveMagicEdenStats, magicEdenCollectionUrls } from "@/lib/magiceden-stats";
import { prisma } from "@/lib/prisma";
import { fetchProjectTokenDisplay } from "@/lib/project-token-display";

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

  const tokenMint = project.tokenMint?.trim() ?? "";
  const tokenDisplay = tokenMint ? await fetchProjectTokenDisplay(tokenMint) : null;

  return (
    <div className="space-y-6">
      <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
        ← Back to projects
      </Link>

      <div className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/80">
        {project.bannerImageUrl ? (
          <div className="relative h-56 w-full sm:h-72 md:h-80">
            <img
              src={project.bannerImageUrl}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-elevated via-transparent to-transparent" />
          </div>
        ) : (
          <div className="min-h-52 bg-gradient-to-r from-accent-purple/30 via-surface to-accent-blue/30 sm:min-h-64" />
        )}
        <div className="space-y-6 px-6 pb-8 pt-6 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
              <ProjectMeLinks urls={meCollectionUrls} />
            </div>
            <ProjectDetailActions
              slug={slug}
              initialLikes={project.likes}
              websiteUrl={project.websiteUrl}
              discordUrl={project.discordUrl}
              twitterUrl={project.twitterUrl}
            />
          </div>

          {live.ok && statRows.length > 0 ? (
            <div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

          {tokenMint && tokenDisplay ? (
            <ProjectTokenBlock mint={tokenMint} symbol={tokenDisplay.symbol} logoUrl={tokenDisplay.logoUrl} />
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
