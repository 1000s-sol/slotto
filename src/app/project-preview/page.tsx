import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { OMERTA_PREVIEW as P } from "@/lib/project-preview/omerta-preview-data";

export const metadata: Metadata = {
  title: "Project page preview · Omerta",
  description:
    "Internal layout preview for a category-based project page (Omerta). Not linked in site navigation.",
  robots: { index: false, follow: false },
};

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "collections", label: "Collections" },
  { id: "token", label: "Token" },
  { id: "staking", label: "Staking" },
  { id: "utilities", label: "Utilities" },
  { id: "bonds", label: "Bonds" },
  { id: "families", label: "Family DAOs" },
  { id: "review", label: "Review" },
] as const;

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-accent-cyan hover:underline"
    >
      {children}
    </a>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  support,
}: {
  id: string;
  eyebrow: string;
  title: string;
  support?: string;
}) {
  return (
    <header className="max-w-2xl scroll-mt-28" id={id}>
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-accent-gold/90">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
        {title}
      </h2>
      {support ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">{support}</p>
      ) : null}
    </header>
  );
}

export default function ProjectPreviewPage() {
  return (
    <div className="space-y-10 pb-16">
      <div className="rounded-xl border border-accent-gold/35 bg-accent-gold/10 px-4 py-3 text-sm text-muted">
        <span className="font-semibold text-accent-gold">Layout preview</span>
        {" — "}
        category-based project page experiment for Omerta. Not in the main nav.
        Compare with the{" "}
        <Link
          href="/projects/omerta-empire-city"
          className="font-medium text-accent-cyan hover:underline"
        >
          live listing
        </Link>
        .
      </div>

      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/80">
        <div className="relative h-52 w-full sm:h-64 md:h-72">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={P.bannerImageUrl}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-elevated via-bg-elevated/40 to-transparent" />
        </div>

        <div className="relative -mt-16 space-y-5 px-5 pb-8 sm:-mt-20 sm:px-8">
          <div className="flex flex-wrap gap-2">
            {P.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-border/80 bg-bg-deep/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="font-[family-name:var(--font-zen-dots)] text-3xl tracking-tight text-foreground sm:text-4xl">
                {P.name}
              </h1>
              <p className="mt-2 text-lg text-accent-cyan/95">{P.tagline}</p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                {P.summary}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <ExternalLink href={P.links.website}>Website</ExternalLink>
              <span className="text-border" aria-hidden>
                ·
              </span>
              <ExternalLink href={P.links.hub}>Empire Hub</ExternalLink>
              <span className="text-border" aria-hidden>
                ·
              </span>
              <ExternalLink href={P.links.discord}>Discord</ExternalLink>
              <span className="text-border" aria-hidden>
                ·
              </span>
              <ExternalLink href={P.links.twitter}>X</ExternalLink>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 border-t border-border/70 pt-5 sm:grid-cols-5">
            {P.facts.map((f) => (
              <div key={f.label}>
                <dt className="text-[11px] uppercase tracking-wide text-muted">
                  {f.label}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Section nav */}
      <nav
        aria-label="Page sections"
        className="sticky top-0 z-10 -mx-1 overflow-x-auto rounded-xl border border-border bg-bg-elevated/95 px-2 py-2 backdrop-blur-md"
      >
        <ul className="flex min-w-max gap-1">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-flex rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface hover:text-foreground"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Overview */}
      <section className="space-y-4" aria-labelledby="overview">
        <SectionHeading
          id="overview"
          eyebrow="Overview"
          title="How the Empire fits together"
          support="Ranked NFTs, a shared token economy, and Family SubDAOs under one branded hub."
        />
        <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-muted sm:text-[15px]">
          {P.overview.map((para) => (
            <p key={para.slice(0, 40)}>{para}</p>
          ))}
        </div>
      </section>

      {/* Collections */}
      <section className="space-y-5" aria-labelledby="collections">
        <SectionHeading
          id="collections"
          eyebrow="Collections"
          title="Hierarchy and Family lines"
          support="Each line maps to rank, revenue, or a SubDAO role inside Empire City."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {P.collections.map((c) => (
            <article
              key={c.name}
              className="border-l-2 border-accent-gold/50 pl-4"
            >
              <h3 className="text-base font-semibold text-foreground">
                {c.name}
              </h3>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-accent-cyan/90">
                {c.role}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{c.blurb}</p>
            </article>
          ))}
        </div>
        <p className="text-xs text-muted">
          Marketplace floors and live stats stay on the{" "}
          <Link
            href="/projects/omerta-empire-city"
            className="text-accent-cyan hover:underline"
          >
            published listing
          </Link>{" "}
          for now — this preview focuses on structure.
        </p>
      </section>

      {/* Token */}
      <section className="space-y-5" aria-labelledby="token">
        <SectionHeading
          id="token"
          eyebrow="Token"
          title="$EMPIRE and the $BOSS loop"
          support="Shared currency for utilities, SubDAOs, and holder reward circulation."
        />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <a
            href={`https://birdeye.so/solana/token/${P.token.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-3 transition hover:opacity-90"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={P.token.logoUrl}
              alt=""
              className="h-14 w-14 rounded-full object-cover ring-1 ring-border"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="text-lg font-semibold text-foreground">
                ${P.token.symbol}
              </div>
              <div className="text-xs text-muted">{P.token.name}</div>
            </div>
          </a>
          <div className="min-w-0 flex-1 space-y-3 text-sm leading-relaxed text-muted">
            <p>{P.token.role}</p>
            <p>
              <span className="font-semibold text-foreground">
                ${P.token.companion.symbol}:
              </span>{" "}
              {P.token.companion.blurb}
            </p>
            <p className="break-all font-mono text-[11px] text-muted/90">
              {P.token.mint}
            </p>
          </div>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {P.token.sinks.map((s) => (
            <li
              key={s}
              className="text-sm text-muted before:mr-2 before:text-accent-gold before:content-['·']"
            >
              {s}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          Full tokenomics page on omerta.so is still marked “coming soon.”
        </p>
      </section>

      {/* Staking */}
      <section className="space-y-5" aria-labelledby="staking">
        <SectionHeading
          id="staking"
          eyebrow="Staking"
          title="Put NFTs and tokens to work"
          support="Published loops for $EMPIRE, $BOSS, NFTs, and bonds."
        />
        <ul className="space-y-4">
          {P.staking.map((item) => (
            <li key={item.title} className="max-w-3xl">
              <h3 className="text-base font-semibold text-foreground">
                {item.href ? (
                  <ExternalLink href={item.href}>{item.title}</ExternalLink>
                ) : (
                  item.title
                )}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {item.detail}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Utilities */}
      <section className="space-y-5" aria-labelledby="utilities">
        <SectionHeading
          id="utilities"
          eyebrow="Utilities"
          title="Empire Hub surface"
          support="Games, quests, traits, banks, and swaps linked from omerta.so/hub."
        />
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {P.utilities.map((u) => (
            <article key={u.title}>
              <h3 className="text-base font-semibold text-foreground">
                <ExternalLink href={u.href}>{u.title}</ExternalLink>
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{u.detail}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Bonds */}
      <section className="space-y-5" aria-labelledby="bonds">
        <SectionHeading
          id="bonds"
          eyebrow="Bonds & buybacks"
          title="Yield instruments and burns"
          support="Community Bonds, Founders Bonds, and publicly tracked $EMPIRE burns."
        />
        <ul className="max-w-3xl space-y-4">
          {P.bonds.map((b) => (
            <li key={b.title}>
              <h3 className="text-base font-semibold text-foreground">
                {b.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{b.detail}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm">
          <ExternalLink href="https://www.omerta.so/empire-bonds">
            Community Bonds
          </ExternalLink>
          {" · "}
          <ExternalLink href="https://www.omerta.so/founders-bonds">
            Founders Bonds
          </ExternalLink>
          {" · "}
          <ExternalLink href="https://www.omerta.so/empire-buy-backs">
            Buybacks
          </ExternalLink>
        </p>
      </section>

      {/* Family DAOs */}
      <section className="space-y-5" aria-labelledby="families">
        <SectionHeading
          id="families"
          eyebrow="Family DAOs"
          title="Allied families on the network"
          support="SubDAOs plug into $EMPIRE utilities while keeping their own culture and tools."
        />
        <div className="grid gap-5 sm:grid-cols-3">
          {P.familyDaos.map((f) => (
            <article key={f.name}>
              <h3 className="text-base font-semibold text-foreground">
                {f.name}
              </h3>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-accent-cyan/90">
                {f.focus}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.detail}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Review */}
      <section className="space-y-5" aria-labelledby="review">
        <SectionHeading
          id="review"
          eyebrow="Review"
          title="Slotto read"
          support="Editorial summary for visitors comparing listings."
        />
        <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-muted sm:text-[15px]">
          {P.reviewMd.split("\n\n").map((para) => (
            <p key={para.slice(0, 48)}>{para}</p>
          ))}
        </div>
        <p className="text-xs text-muted">
          Sources: published Slotto listing +{" "}
          <ExternalLink href="https://www.omerta.so/">omerta.so</ExternalLink>{" "}
          (collections, utilities, ecosystem, hub, bonds, roadmap, whitepaper).
        </p>
      </section>
    </div>
  );
}
