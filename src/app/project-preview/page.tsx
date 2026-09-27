import type { Metadata } from "next";
import Link from "next/link";

import { ProjectCollectionsPanel } from "@/components/project/project-collections-panel";
import { ProjectSocialLinks } from "@/components/project/project-detail-actions";
import { ProjectListingSections } from "@/components/project/project-listing-sections";
import { ProjectTokenBlock } from "@/components/project/project-token-block";
import { fetchLiveMagicEdenStats } from "@/lib/magiceden-stats";
import { magicEdenLink } from "@/lib/project-collections";
import { OMERTA_PREVIEW as P } from "@/lib/project-preview/omerta-preview-data";
import { listingSectionsFromProject } from "@/lib/project-listing-sections";
import { fetchProjectTokenDisplay } from "@/lib/project-token-display";

export const metadata: Metadata = {
  title: "Project page preview · Omerta",
  description:
    "Fixed five-tile project listing preview. Not linked in navigation.",
  robots: { index: false, follow: false },
};

export default async function ProjectPreviewPage() {
  const collections = [...P.collections];
  const statsByIndex = await Promise.all(
    collections.map((c) => fetchLiveMagicEdenStats(magicEdenLink(c), 120)),
  );

  const tokenDisplay = await fetchProjectTokenDisplay(P.tokenMint, {
    liquid: P.tokenLiquid,
    tokenImageUrl: P.tokenImageUrl,
    tokenName: P.tokenName,
  });

  const sections = listingSectionsFromProject({
    sectionOverview: P.sections.find((s) => s.id === "overview")?.body,
    sectionStaking: P.sections.find((s) => s.id === "staking")?.body,
    sectionToken: P.sections.find((s) => s.id === "token")?.body,
    sectionHolderUtility: P.sections.find((s) => s.id === "holderUtility")?.body,
    sectionServices: P.sections.find((s) => s.id === "services")?.body,
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-accent-gold/35 bg-accent-gold/10 px-4 py-3 text-sm text-muted">
        <span className="font-semibold text-accent-gold">Layout preview</span>
        {" — "}
        fixed five content tiles + existing collections/sales/token chrome. Not
        in nav.{" "}
        <Link
          href="/projects/omerta-empire-city"
          className="font-medium text-accent-cyan hover:underline"
        >
          Live listing
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/80">
        <div className="relative h-56 w-full sm:h-72 md:h-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={P.bannerImageUrl}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-elevated via-transparent to-transparent" />
        </div>

        <div className="space-y-6 px-6 pb-8 pt-6 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-semibold tracking-tight">{P.name}</h1>
            </div>
            <ProjectSocialLinks
              websiteUrl={P.websiteUrl}
              discordUrl={P.discordUrl}
              twitterUrl={P.twitterUrl}
            />
          </div>

          <ProjectCollectionsPanel
            collections={collections}
            statsByIndex={statsByIndex}
          />

          <ProjectTokenBlock
            mint={P.tokenMint}
            symbol={tokenDisplay.symbol}
            logoUrl={tokenDisplay.logoUrl}
            liquid={P.tokenLiquid}
          />

          <ProjectListingSections sections={sections} />
        </div>
      </div>
    </div>
  );
}
