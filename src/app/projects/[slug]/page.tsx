import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectCollectionsPanel } from "@/components/project/project-collections-panel";
import { ProjectLikePill, ProjectSocialLinks } from "@/components/project/project-detail-actions";
import { ProjectTokenBlock } from "@/components/project/project-token-block";
import { fetchLiveMagicEdenStats } from "@/lib/magiceden-stats";
import {
  magicEdenLink,
  parseProjectCollections,
} from "@/lib/project-collections";
import { prisma } from "@/lib/prisma";
import { fetchProjectTokenDisplay } from "@/lib/project-token-display";

type Props = { params: Promise<{ slug: string }> };

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = await prisma.project.findFirst({
    where: { slug, published: true },
  });
  if (!project) notFound();

  const collections = parseProjectCollections(
    project.collections,
    project.meUrls,
    project.meUrl,
    project.marketplaces,
  );

  const statsByIndex = await Promise.all(
    collections.map((c) => fetchLiveMagicEdenStats(magicEdenLink(c), 120)),
  );

  const tokenMint = project.tokenMint?.trim() ?? "";
  const tokenLiquid = project.tokenLiquid ?? true;
  const tokenDisplay = tokenMint
    ? await fetchProjectTokenDisplay(tokenMint, {
        liquid: tokenLiquid,
        tokenImageUrl: project.tokenImageUrl,
        tokenName: project.tokenName,
      })
    : null;

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
            <ProjectLikePill
              slug={slug}
              initialLikes={project.likes}
              className="absolute right-3 top-3 z-20 sm:right-4 sm:top-4"
            />
          </div>
        ) : (
          <div className="relative min-h-52 bg-gradient-to-r from-accent-purple/30 via-surface to-accent-blue/30 sm:min-h-64">
            <ProjectLikePill
              slug={slug}
              initialLikes={project.likes}
              className="absolute right-3 top-3 z-20 sm:right-4 sm:top-4"
            />
          </div>
        )}
        <div className="space-y-6 px-6 pb-8 pt-6 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
            </div>
            <ProjectSocialLinks
              websiteUrl={project.websiteUrl}
              discordUrl={project.discordUrl}
              twitterUrl={project.twitterUrl}
            />
          </div>

          {collections.some((c) => c.links.length > 0) ? (
            <ProjectCollectionsPanel collections={collections} statsByIndex={statsByIndex} />
          ) : null}

          {tokenMint && tokenDisplay ? (
            <ProjectTokenBlock
              mint={tokenMint}
              symbol={tokenDisplay.symbol}
              logoUrl={tokenDisplay.logoUrl}
              liquid={tokenLiquid}
            />
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
