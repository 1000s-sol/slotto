import { Suspense } from "react";

import { FeaturedProjectOfWeek } from "@/components/project/featured-project-of-week";
import { ProjectCardTile } from "@/components/project/project-card-tile";
import { ProjectsToolbar } from "@/components/project/projects-toolbar";
import { pickFeaturedProject } from "@/lib/pick-featured-project";
import { floorSolSortKey } from "@/lib/project-floor-sort";
import { prisma } from "@/lib/prisma";
import { getFeaturedProjectSlugFromDb } from "@/lib/site-settings";

type Props = { searchParams: Promise<{ q?: string; sort?: string }> };

type SortMode = "likes" | "name" | "floor";

type ProjectRow = {
  slug: string;
  name: string;
  likes: number;
  reviewMd: string;
  bannerImageUrl: string | null;
  listingImageUrl: string | null;
  stats: unknown;
};

function parseSort(raw: string | undefined): SortMode {
  if (raw === "name" || raw === "floor") return raw;
  return "likes";
}

function sortProjects(list: ProjectRow[], sort: SortMode): ProjectRow[] {
  const out = [...list];
  if (sort === "name") {
    out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  } else if (sort === "floor") {
    out.sort((a, b) => {
      const fa = floorSolSortKey(a.stats);
      const fb = floorSolSortKey(b.stats);
      if (fa !== fb) return fa - fb;
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

  const select = {
    slug: true,
    name: true,
    likes: true,
    reviewMd: true,
    bannerImageUrl: true,
    listingImageUrl: true,
    stats: true,
  } as const;

  let featured: ProjectRow | null = null;
  let grid: ProjectRow[];

  if (query) {
    const raw = await prisma.project.findMany({
      where: {
        published: true,
        name: { contains: query, mode: "insensitive" as const },
      },
      select,
    });
    grid = sortProjects(raw as ProjectRow[], sort);
  } else {
    const [allRows, adminFeaturedSlug] = await Promise.all([
      prisma.project.findMany({
        where: { published: true },
        select,
      }),
      getFeaturedProjectSlugFromDb(),
    ]);
    const all = allRows as ProjectRow[];
    featured = pickFeaturedProject(all, adminFeaturedSlug);
    grid = sortProjects(all, sort);
  }

  return (
    <div className="space-y-8">
      {!query && featured ? (
        <FeaturedProjectOfWeek
          slug={featured.slug}
          name={featured.name}
          likes={featured.likes}
          reviewMd={featured.reviewMd}
          imageUrl={thumb(featured)}
        />
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
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
