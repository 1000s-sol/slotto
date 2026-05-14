import Link from "next/link";

import { prisma } from "@/lib/prisma";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function ProjectsPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim();

  const projects = await prisma.project.findMany({
    where: {
      published: true,
      ...(query
        ? {
            name: {
              contains: query,
              mode: "insensitive" as const,
            },
          }
        : {}),
    },
    orderBy: [{ name: "asc" }],
    select: {
      slug: true,
      name: true,
      bannerImageUrl: true,
      listingImageUrl: true,
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Curated listings in alphabetical order. Search filters the public directory.
          </p>
        </div>
        <form className="flex w-full flex-col gap-2 text-xs text-muted sm:w-72" action="/projects" method="get">
          <label htmlFor="q">Search</label>
          <input
            id="q"
            name="q"
            defaultValue={query ?? ""}
            placeholder="Search by project name"
            className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-foreground outline-none ring-accent-purple/0 transition focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
          />
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/70">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface/40 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Project</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-muted">
                  {query ? "No published projects match that search." : "No published projects yet."}
                </td>
              </tr>
            ) : (
              projects.map((p) => {
                const thumb = p.listingImageUrl || p.bannerImageUrl;
                return (
                <tr key={p.slug} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-border bg-surface/50 sm:size-16">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted">
                            —
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/projects/${p.slug}`}
                          className="font-medium text-foreground hover:text-accent-cyan"
                        >
                          {p.name}
                        </Link>
                      </div>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
