import Link from "next/link";

/** Seed data until Prisma + admin CRUD land */
const seedProjects = [
  {
    slug: "example-lab",
    name: "Example Lab",
    likes: 128,
    tagline: "Placeholder listing for layout review.",
  },
];

export default function ProjectsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Sorted by likes. Search by name (wired to the database next).
          </p>
        </div>
        <label className="flex w-full flex-col gap-2 text-xs text-muted sm:w-72">
          Search
          <input
            placeholder="Search by project name"
            className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-foreground outline-none ring-accent-purple/0 transition focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/70">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface/40 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Likes</th>
            </tr>
          </thead>
          <tbody>
            {seedProjects.map((p) => (
              <tr key={p.slug} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-4">
                  <Link
                    href={`/projects/${p.slug}`}
                    className="font-medium text-foreground hover:text-accent-cyan"
                  >
                    {p.name}
                  </Link>
                  <div className="mt-1 text-xs text-muted">{p.tagline}</div>
                </td>
                <td className="px-4 py-4 text-muted">{p.likes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
