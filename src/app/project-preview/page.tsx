import type { Metadata } from "next";
import Link from "next/link";

import { ProjectCollectionsPanel } from "@/components/project/project-collections-panel";
import { ProjectSocialLinks } from "@/components/project/project-detail-actions";
import { ProjectTokenBlock } from "@/components/project/project-token-block";
import { fetchLiveMagicEdenStats } from "@/lib/magiceden-stats";
import { magicEdenLink } from "@/lib/project-collections";
import {
  OMERTA_PREVIEW as P,
  SUGGESTED_EXTRA_FIELDS,
  type ProjectListingFields,
} from "@/lib/project-preview/omerta-preview-data";
import { fetchProjectTokenDisplay } from "@/lib/project-token-display";

export const metadata: Metadata = {
  title: "Project page preview · Omerta",
  description:
    "Structured project listing preview (form-field layout). Not linked in navigation.",
  robots: { index: false, follow: false },
};

/** Field labels match the intended admin create/edit inputs. */
const FIELD_META: {
  key: keyof ProjectListingFields;
  label: string;
  adminHint: string;
}[] = [
  {
    key: "overview",
    label: "Overview",
    adminHint: "Concise review — project, history, main benefits",
  },
  {
    key: "stakingWhere",
    label: "Rewards / staking — where",
    adminHint: "Stake URLs and platforms",
  },
  {
    key: "stakingRewards",
    label: "Rewards / staking — what you receive",
    adminHint: "Tokens / revenue / perks from staking",
  },
  {
    key: "stakingCollectionNotes",
    label: "Rewards / staking — by collection",
    adminHint: "Collection-specific staking notes",
  },
  {
    key: "tokenLpBacked",
    label: "Token — LP / liquidity",
    adminHint: "LP-backed? Depth / caveats",
  },
  {
    key: "tokenUtility",
    label: "Token — what you can do with it",
    adminHint: "Primary token utility",
  },
  {
    key: "tokenSecondary",
    label: "Token — secondary (optional)",
    adminHint: "Leave blank if none",
  },
  {
    key: "holderUtility",
    label: "Holder utility",
    adminHint: "Non-staking utilities for holders",
  },
  {
    key: "services",
    label: "Services for other collections",
    adminHint: "Leave blank if the project does not offer this",
  },
];

function FieldBlock({
  label,
  adminHint,
  value,
}: {
  label: string;
  adminHint: string;
  value: string;
}) {
  const trimmed = value.trim();
  if (!trimmed) {
    return (
      <section className="space-y-2 border-t border-border/70 pt-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{label}</h2>
          <p className="text-[11px] text-muted">Admin: {adminHint}</p>
        </div>
        <p className="text-sm italic text-muted/70">Not provided for this listing.</p>
      </section>
    );
  }

  return (
    <section className="space-y-2 border-t border-border/70 pt-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{label}</h2>
        <p className="text-[11px] text-muted">Admin: {adminHint}</p>
      </div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
        {trimmed}
      </div>
    </section>
  );
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
        same listing chrome (collections + sales + token), then fixed content
        fields that will map 1:1 to admin inputs. Not in nav.{" "}
        <Link
          href="/projects/omerta-empire-city"
          className="font-medium text-accent-cyan hover:underline"
        >
          Live listing
        </Link>
      </div>

      {/* Same shell as /projects/[slug] */}
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

          {/* Structured fields — replace freeform reviewMd wall */}
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent-gold/90">
              Listing content fields
            </p>
            {FIELD_META.map((f) => (
              <FieldBlock
                key={f.key}
                label={f.label}
                adminHint={f.adminHint}
                value={P.fields[f.key]}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Suggestions for the form — preview-only note */}
      <aside className="rounded-2xl border border-border bg-bg-elevated/60 px-5 py-5 text-sm text-muted">
        <h2 className="text-base font-semibold text-foreground">
          Suggested extra fields (optional)
        </h2>
        <p className="mt-1 text-xs text-muted">
          Not shown as filled sections above — candidates for the create/edit
          form if you want them.
        </p>
        <ul className="mt-4 space-y-3">
          {SUGGESTED_EXTRA_FIELDS.map((f) => (
            <li key={f.key}>
              <span className="font-medium text-foreground">{f.label}</span>
              <span className="text-muted"> — {f.hint}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
