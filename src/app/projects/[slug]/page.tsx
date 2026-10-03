import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectCollectionsPanel } from "@/components/project/project-collections-panel";
import { ProjectLikePill, ProjectSocialLinks } from "@/components/project/project-detail-actions";
import { ProjectListingSections } from "@/components/project/project-listing-sections";
import { ProjectTicketBuyPanel } from "@/components/project/project-ticket-buy-panel";
import { ProjectTokenBlock } from "@/components/project/project-token-block";
import { fetchLiveCollectionStats } from "@/lib/magiceden-stats";
import {
  magicEdenLink,
  orbisLink,
  parseProjectCollections,
} from "@/lib/project-collections";
import { ensureProjectSectionColumns } from "@/lib/ensure-project-section-columns";
import {
  hasListingSections,
  listingSectionsFromProject,
  listingShareBlurb,
} from "@/lib/project-listing-sections";
import { prisma } from "@/lib/prisma";
import { fetchProjectSocialCounts } from "@/lib/project-social-stats";
import { fetchProjectTokenDisplay } from "@/lib/project-token-display";
import {
  getRequestSiteUrl,
  projectShareDescription,
  projectShareImageUrl,
} from "@/lib/project-share-meta";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  await ensureProjectSectionColumns();
  const project = await prisma.project.findFirst({
    where: { slug, published: true },
    select: {
      name: true,
      reviewMd: true,
      sectionOverview: true,
      sectionStaking: true,
      sectionToken: true,
      sectionHolderUtility: true,
      sectionServices: true,
      bannerImageUrl: true,
      listingImageUrl: true,
    },
  });

  if (!project) {
    return { title: "Project not found" };
  }

  const siteUrl = await getRequestSiteUrl();
  const title = project.name;
  const description = projectShareDescription(listingShareBlurb(project));
  const image = projectShareImageUrl(project.bannerImageUrl, project.listingImageUrl, siteUrl);
  const pageUrl = `${siteUrl.replace(/\/$/, "")}/projects/${slug}`;
  const isDefaultImage = image.includes("/brand/slotto-tickets");

  return {
    title,
    description,
    openGraph: {
      type: "website",
      url: pageUrl,
      title: `${title} · Slotto`,
      description,
      siteName: "Slotto",
      images: [
        {
          url: image,
          alt: `${title} on Slotto`,
          ...(isDefaultImage ? { width: 1254, height: 1254 } : {}),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · Slotto`,
      description,
      images: [{ url: image, alt: `${title} on Slotto` }],
    },
  };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  await ensureProjectSectionColumns();
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

  const [statsByIndex, socialCounts, tokenDisplay] = await Promise.all([
    Promise.all(
      collections.map((c) =>
        fetchLiveCollectionStats(magicEdenLink(c), orbisLink(c), 120),
      ),
    ),
    fetchProjectSocialCounts(project.discordUrl, project.twitterUrl),
    project.tokenMint?.trim()
      ? fetchProjectTokenDisplay(project.tokenMint.trim(), {
          liquid: project.tokenLiquid ?? true,
          tokenImageUrl: project.tokenImageUrl,
          tokenName: project.tokenName,
        })
      : Promise.resolve(null),
  ]);

  const tokenMint = project.tokenMint?.trim() ?? "";
  const tokenLiquid = project.tokenLiquid ?? true;

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
        ← Back to projects
      </Link>

      <div className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-border bg-bg-elevated/80">
        {project.bannerImageUrl ? (
          <div className="relative aspect-[3/1] w-full max-w-full overflow-hidden bg-bg-deep">
            <img
              src={project.bannerImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full max-w-full object-cover object-center"
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
          <div className="relative aspect-[3/1] w-full max-w-full overflow-hidden bg-gradient-to-r from-accent-purple/30 via-surface to-accent-blue/30">
            <ProjectLikePill
              slug={slug}
              initialLikes={project.likes}
              className="absolute right-3 top-3 z-20 sm:right-4 sm:top-4"
            />
          </div>
        )}
        <div className="min-w-0 space-y-6 px-4 pb-8 pt-6 sm:px-8">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-semibold tracking-tight break-words">{project.name}</h1>
            </div>
            <ProjectSocialLinks
              websiteUrl={project.websiteUrl}
              discordUrl={project.discordUrl}
              twitterUrl={project.twitterUrl}
              discordMembers={socialCounts.discordMembers}
              twitterFollowers={socialCounts.twitterFollowers}
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

          {tokenMint && tokenDisplay ? (
            <ProjectTicketBuyPanel
              mint={tokenMint}
              symbol={tokenDisplay.symbol}
              logoUrl={tokenDisplay.logoUrl}
              projectName={project.name}
            />
          ) : null}

          {hasListingSections(project) ? (
            <ProjectListingSections sections={listingSectionsFromProject(project)} />
          ) : (
            <article className="prose prose-invert max-w-none prose-headings:scroll-mt-24 prose-p:text-muted prose-li:text-muted">
              <pre className="whitespace-pre-wrap rounded-xl border border-border bg-bg-deep/60 p-4 font-sans text-sm leading-relaxed text-muted">
                {project.reviewMd}
              </pre>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
