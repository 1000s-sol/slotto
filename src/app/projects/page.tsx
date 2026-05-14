import Link from "next/link";
import { Suspense } from "react";

import { FeaturedProjectOfWeek } from "@/components/project/featured-project-of-week";
import { ProjectCardTile } from "@/components/project/project-card-tile";
import { ProjectsToolbar } from "@/components/project/projects-toolbar";
import { floorSolSortKey } from "@/lib/project-floor-sort";
import { prisma } from "@/lib/prisma";

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

function pickFeatured(all: ProjectRow[]): ProjectRow | null {
  if (all.length === 0) return null;
  const envSlug = process.env.FEATURED_PROJECT_SLUG?.trim();
  if (envSlug) {
    const hit = all.find((p) => p.slug === envSlug);
    if (hit) return hit;
  }
  const byLikes = [...all].sort((a, b) => b.likes - a.likes || a.name.localeCompare(b.name));
  return byLikes[0] ?? null;
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
    const all = (await prisma.project.findMany({
      where: { published: true },
      select,
    })) as ProjectRow[];
    const featuredPick = pickFeatured(all);
    featured = featuredPick;
    const rest = featuredPick ? all.filter((p) => p.slug !== featuredPick.slug) : all;
    grid = sortProjects(rest, sort);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
        </div>
        <Suspense
          fallback={
            <div className="h-[4.5rem] w-full max-w-sm animate-pulse rounded-xl bg-surface/40 sm:ml-auto sm:w-72" />
          }
        >
          <ProjectsToolbar defaultSort="likes" />
        </Suspense>
      </div>

      {!query && featured ? (
        <FeaturedProjectOfWeek
          slug={featured.slug}
          name={featured.name}
          likes={featured.likes}
          reviewMd={featured.reviewMd}
          imageUrl={thumb(featured)}
        />
      ) : null}

      {grid.length === 0 && !featured ? (
        <div className="rounded-2xl border border-border bg-bg-elevated/70 px-6 py-14 text-center text-sm text-muted">
          {query ? "No published projects match that search." : "No published projects yet."}
        </div>
      ) : grid.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
