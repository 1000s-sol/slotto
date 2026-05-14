import Link from "next/link";

import { prisma } from "@/lib/prisma";

type Props = { searchParams: Promise<{ deleted?: string }> };

export default async function AdminProjectsListPage({ searchParams }: Props) {
  const { deleted } = await searchParams;
  const projects = await prisma.project.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      published: true,
      updatedAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Drafts stay private until you tick <span className="text-foreground">Published</span>. Only
            published projects appear on the public directory.
          </p>
        </div>
        <Link
          href="/admin/projects/new"
          className="inline-flex rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-purple/20"
        >
          + New project
        </Link>
      </div>

      {deleted ? (
        <div className="rounded-xl border border-border bg-surface/40 px-4 py-2 text-sm text-muted">
          Project deleted.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/70">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface/40 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">
                  No projects yet.{" "}
                  <Link href="/admin/projects/new" className="text-accent-cyan hover:underline">
                    Create one
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              projects.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-4 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-4 font-mono text-xs text-muted">{p.slug}</td>
                  <td className="px-4 py-4">
                    {p.published ? (
                      <span className="rounded-full bg-emerald-950/60 px-2 py-0.5 text-xs font-medium text-emerald-300">
                        Live
                      </span>
                    ) : (
                      <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs text-muted">
                    {p.updatedAt.toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/admin/projects/${p.slug}/edit`}
                      className="text-sm text-accent-cyan hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
