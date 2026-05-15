import Link from "next/link";

import { updateFeaturedProjectAction } from "@/app/admin/(dashboard)/settings/actions";
import { prisma } from "@/lib/prisma";
import { getFeaturedProjectSlugFromDb } from "@/lib/site-settings";

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminSettingsPage({ searchParams }: Props) {
  const { saved, error } = await searchParams;

  const [published, currentSlug] = await Promise.all([
    prisma.project.findMany({
      where: { published: true },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
    getFeaturedProjectSlugFromDb(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Site settings</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Control which published project appears in the <span className="text-foreground">Featured this week</span>{" "}
          block on the public{" "}
          <Link href="/projects" className="text-accent-cyan hover:underline">
            /projects
          </Link>{" "}
          page. Manual choice overrides <span className="font-mono text-foreground">FEATURED_PROJECT_SLUG</span> in
          env; leaving automatic uses env (if set and valid) then highest likes.
        </p>
      </div>

      {saved ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/25 px-4 py-2 text-sm text-emerald-200">
          Featured project setting saved.
        </div>
      ) : null}
      {error === "not-found" ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/25 px-4 py-2 text-sm text-red-200">
          That slug is not a published project. Pick a live listing or use automatic.
        </div>
      ) : null}

      <form
        action={updateFeaturedProjectAction}
        className="max-w-xl space-y-4 rounded-2xl border border-border bg-bg-elevated/70 p-6"
      >
        <label className="flex flex-col gap-2 text-sm text-foreground">
          <span className="font-medium">Featured on /projects</span>
          <select
            name="featuredProjectSlug"
            defaultValue={currentSlug ?? ""}
            className="rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent-purple/40 focus:ring-4 focus:ring-accent-purple/15"
          >
            <option value="">Automatic (env slug if set, else highest likes)</option>
            {published.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name} ({p.slug})
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs leading-relaxed text-muted">
          After adding the <span className="font-mono text-foreground/90">SiteSettings</span> model, apply schema to your database (e.g.{" "}
          <span className="font-mono text-foreground/90">npx prisma db push</span> or your migration flow).
        </p>
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-purple/20"
        >
          Save
        </button>
      </form>
    </div>
  );
}
