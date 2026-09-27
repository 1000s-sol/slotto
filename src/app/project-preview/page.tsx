import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { ProjectCollectionsPanel } from "@/components/project/project-collections-panel";
import { ProjectSocialLinks } from "@/components/project/project-detail-actions";
import { ProjectTokenBlock } from "@/components/project/project-token-block";
import { fetchLiveMagicEdenStats } from "@/lib/magiceden-stats";
import { magicEdenLink } from "@/lib/project-collections";
import {
  OMERTA_PREVIEW as P,
  type PreviewSectionId,
} from "@/lib/project-preview/omerta-preview-data";
import { fetchProjectTokenDisplay } from "@/lib/project-token-display";

export const metadata: Metadata = {
  title: "Project page preview · Omerta",
  description:
    "Fixed five-tile project listing preview. Not linked in navigation.",
  robots: { index: false, follow: false },
};

function SectionIcon({ id }: { id: PreviewSectionId }) {
  const cls = "h-5 w-5 shrink-0 text-accent-gold";
  const common = {
    className: cls,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    "aria-hidden": true as const,
  };

  let paths: ReactNode;
  switch (id) {
    case "overview":
      paths = (
        <>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 19.5V6.75A2.25 2.25 0 016.25 4.5h11.5A2.25 2.25 0 0120 6.75v12.75"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 8.5h8M8 12h8M8 15.5h5" />
        </>
      );
      break;
    case "staking":
      paths = (
        <>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v18M7 8.5c0-1.8 2.2-3 5-3s5 1.2 5 3-2.2 3-5 3-5 1.2-5 3 2.2 3 5 3 5-1.2 5-3"
          />
        </>
      );
      break;
    case "token":
      paths = (
        <>
          <circle cx="12" cy="12" r="8.25" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5v9M9.5 9.75h3.75a1.75 1.75 0 010 3.5H9.5" />
        </>
      );
      break;
    case "holderUtility":
      paths = (
        <>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.25 7.5a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zM5.25 19.5a4.5 4.5 0 019 0M17.25 11.25l1.5 1.5 3-3"
          />
        </>
      );
      break;
    case "services":
      paths = (
        <>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.42 15.17l-4.66 2.33a.75.75 0 01-1.03-.9l1.2-4.02a.75.75 0 00-.2-.75L3.5 9.35a.75.75 0 01.44-1.3l4.2-.3a.75.75 0 00.6-.45l1.55-3.85a.75.75 0 011.36 0l1.55 3.85a.75.75 0 00.6.45l4.2.3a.75.75 0 01.44 1.3l-3.23 2.48a.75.75 0 00-.2.75l1.2 4.02a.75.75 0 01-1.03.9l-4.66-2.33a.75.75 0 00-.72 0z"
          />
        </>
      );
      break;
    default:
      paths = null;
  }

  return <svg {...common}>{paths}</svg>;
}

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

          <div className="grid gap-4 sm:grid-cols-2">
            {P.sections.map((section) => (
              <section
                key={section.id}
                className={
                  section.id === "overview"
                    ? "space-y-3 rounded-xl border border-border bg-bg-deep/40 p-4 sm:col-span-2"
                    : "space-y-3 rounded-xl border border-border bg-bg-deep/40 p-4"
                }
              >
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface/50">
                    <SectionIcon id={section.id} />
                  </span>
                  <h2 className="text-base font-semibold text-foreground">
                    {section.label}
                  </h2>
                </div>
                <p className="text-sm leading-relaxed text-muted">{section.body}</p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
