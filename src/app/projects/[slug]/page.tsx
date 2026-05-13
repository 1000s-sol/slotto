import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

const seed = {
  example_lab: {
    name: "Example Lab",
    reviewMd: `## Review (Markdown)

This is placeholder content. Utilities and roadmap will live inside the final write-up.

- **Utility:** staking, raffles, partner drops  
- **Roadmap:** mobile client → cross-chain bridges → expanded game modes  
`,
    meUrl: "https://magiceden.us/marketplace/example",
    marketplaces: [
      { label: "Magic Eden", href: "https://magiceden.us/" },
      { label: "Tensor", href: "https://www.tensor.trade/" },
    ],
    discord: "https://discord.com/",
    twitter: "https://x.com/",
    tokenMint: "TokenMint11111111111111111111111111111111",
    stats: {
      floor: "1.24",
      supply: "3333",
      listings: "4%",
      volume: "12.4k",
      sales24h: "18",
    },
  },
} as const;

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const key = slug.replace(/-/g, "_") as keyof typeof seed;
  const project = seed[key as keyof typeof seed];
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
      >
        ← Back to projects
      </Link>

      <div className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/80">
        <div className="h-40 bg-gradient-to-r from-accent-purple/30 via-surface to-accent-blue/30" />
        <div className="space-y-6 px-6 pb-8 pt-6 sm:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
              <p className="mt-2 text-sm text-muted">
                Magic Eden URL (for stats):{" "}
                <a className="text-accent-cyan hover:underline" href={project.meUrl}>
                  {project.meUrl}
                </a>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={project.discord}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:border-accent-purple/40 hover:text-foreground"
              >
                Discord
              </a>
              <a
                href={project.twitter}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:border-accent-purple/40 hover:text-foreground"
              >
                X
              </a>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-5">
            {(
              [
                ["Floor", project.stats.floor],
                ["Supply", project.stats.supply],
                ["Listings", project.stats.listings],
                ["Volume", project.stats.volume],
                ["24h sales", project.stats.sales24h],
              ] as const
            ).map(([k, v]) => (
              <div
                key={k}
                className="rounded-xl border border-border bg-surface/50 px-3 py-3 text-sm"
              >
                <div className="text-xs uppercase tracking-wide text-muted">{k}</div>
                <div className="mt-1 font-semibold text-foreground">{v}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-surface/40 p-4 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted">Project token</div>
            <div className="mt-1 break-all font-mono text-xs text-foreground">{project.tokenMint}</div>
          </div>

          <div>
            <h2 className="text-lg font-semibold">Marketplaces</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {project.marketplaces.map((m) => (
                <li key={m.href}>
                  <a className="text-accent-cyan hover:underline" href={m.href}>
                    {m.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

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
