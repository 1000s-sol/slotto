import { Suspense } from "react";

import { FeaturedProjectOfWeek } from "@/components/project/featured-project-of-week";
import { ProjectCardTile } from "@/components/project/project-card-tile";
import { ProjectsToolbar } from "@/components/project/projects-toolbar";
import { ensureProjectSectionColumns } from "@/lib/ensure-project-section-columns";
import { ensureProjectSocialColumns } from "@/lib/ensure-project-social-columns";
import { pickFeaturedProject } from "@/lib/pick-featured-project";
import { prisma } from "@/lib/prisma";
import { refreshSocialCountsForSort } from "@/lib/project-social-stats";
import { getFeaturedProjectSlugFromDb } from "@/lib/site-settings";

type Props = { searchParams: Promise<{ q?: string; sort?: string }> };

type SortMode = "likes" | "name" | "discord" | "twitter";

type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  likes: number;
  reviewMd: string;
  sectionOverview: string | null;
  bannerImageUrl: string | null;
  listingImageUrl: string | null;
  discordUrl: string | null;
  twitterUrl: string | null;
  discordMembers: number | null;
  twitterFollowers: number | null;
  socialCountsAt: Date | null;
};

function parseSort(raw: string | undefined): SortMode {
  if (raw === "name" || raw === "discord" || raw === "twitter") return raw;
  return "likes";
}

function sortProjects(
  list: ProjectRow[],
  sort: SortMode,
  socialCounts?: Map<string, number | null>,
): ProjectRow[] {
  const out = [...list];
  if (sort === "name") {
    out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  } else if (sort === "discord" || sort === "twitter") {
    out.sort((a, b) => {
      const av =
        socialCounts?.get(a.id) ??
        (sort === "discord" ? a.discordMembers : a.twitterFollowers) ??
        -1;
      const bv =
        socialCounts?.get(b.id) ??
        (sort === "discord" ? b.discordMembers : b.twitterFollowers) ??
        -1;
      if (bv !== av) return bv - av;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  } else {
    out.sort((a, b) => {
      if (b.likes !== a.likes) return b.likes - a.likes;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }
  return out;
}

function thumb(p: Pick<ProjectRow, "listingImageUrl" | "bannerImageUrl">) {
  return p.listingImageUrl || p.bannerImageUrl;
}

export default async function ProjectsPage({ searchParams }: Props) {
  const { q, sort: sortRaw } = await searchParams;
  const query = q?.trim();
  const sort = parseSort(sortRaw);

  // Prod may not have been db-pushed yet — add nullable columns if missing.
  // Touches only Project via ADD COLUMN IF NOT EXISTS (safe for live draws).
  await Promise.all([ensureProjectSectionColumns(), ensureProjectSocialColumns()]);

  const select = {
    id: true,
    slug: true,
    name: true,
    likes: true,
    reviewMd: true,
    sectionOverview: true,
    bannerImageUrl: true,
    listingImageUrl: true,
    discordUrl: true,
    twitterUrl: true,
    discordMembers: true,
    twitterFollowers: true,
    socialCountsAt: true,
  } as const;

  const statsPromise = Promise.all([
    prisma.project.count({ where: { published: true } }),
    prisma.project.count({
      where: { published: true, NOT: { tokenMint: null } },
    }),
  ]);

  let featured: ProjectRow | null = null;
  let grid: ProjectRow[];
  let stats: { projectCount: number; tokenCount: number };

  if (query) {
    const [raw, counts] = await Promise.all([
      prisma.project.findMany({
        where: {
          published: true,
          name: { contains: query, mode: "insensitive" as const },
        },
        select,
      }),
      statsPromise,
    ]);
    let socialCounts: Map<string, number | null> | undefined;
    if (sort === "discord" || sort === "twitter") {
      socialCounts = await refreshSocialCountsForSort(raw as ProjectRow[], sort);
    }
    grid = sortProjects(raw as ProjectRow[], sort, socialCounts);
    stats = { projectCount: counts[0], tokenCount: counts[1] };
  } else {
    const [allRows, adminFeaturedSlug, counts] = await Promise.all([
      prisma.project.findMany({
        where: { published: true },
        select,
      }),
      getFeaturedProjectSlugFromDb(),
      statsPromise,
    ]);
    const all = allRows as ProjectRow[];
    featured = pickFeaturedProject(all, adminFeaturedSlug);
    let socialCounts: Map<string, number | null> | undefined;
    if (sort === "discord" || sort === "twitter") {
      socialCounts = await refreshSocialCountsForSort(all, sort);
    }
    grid = sortProjects(all, sort, socialCounts);
    stats = { projectCount: counts[0], tokenCount: counts[1] };
  }

  return (
    <div className="min-w-0 max-w-full space-y-8">
      {!query && featured ? (
        <FeaturedProjectOfWeek
          slug={featured.slug}
          name={featured.name}
          likes={featured.likes}
          reviewMd={featured.sectionOverview?.trim() || featured.reviewMd}
          imageUrl={thumb(featured)}
        />
      ) : null}

      <div className="min-w-0 space-y-3">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
            <p className="mt-2 text-sm font-bold leading-relaxed text-foreground">
              All listings are independent and unbiased. Slotto.gg does not offer paid promotion of any kind.
            </p>
          </div>
          <Suspense
            fallback={
              <div className="h-[4.5rem] w-full max-w-sm animate-pulse rounded-xl bg-surface/40 sm:ml-auto sm:w-72" />
            }
          >
            <ProjectsToolbar defaultSort="likes" />
          </Suspense>
        </div>
        <div className="flex w-full gap-2.5 rounded-xl border border-border bg-bg-elevated/70 px-3.5 py-3 text-sm leading-relaxed text-muted">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 h-4 w-4 shrink-0 text-foreground/70"
            aria-hidden
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <p>
            Listing details are preliminary, agent-compiled research — not necessarily from the projects
            themselves, and not guaranteed accurate. Verify independently before investing.
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="inline text-muted">Projects listed: </dt>
            <dd className="inline font-semibold tabular-nums text-foreground">{stats.projectCount}</dd>
          </div>
          <div>
            <dt className="inline text-muted">Tokens enabled: </dt>
            <dd className="inline font-semibold tabular-nums text-foreground">{stats.tokenCount}</dd>
          </div>
        </dl>
      </div>

      {grid.length === 0 && !featured ? (
        <div className="rounded-2xl border border-border bg-bg-elevated/70 px-6 py-14 text-center text-sm text-muted">
          {query ? "No published projects match that search." : "No published projects yet."}
        </div>
      ) : grid.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
          {grid.map((p) => (
            <ProjectCardTile
              key={p.slug}
              slug={p.slug}
              name={p.name}
              likes={p.likes}
              imageUrl={thumb(p)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
