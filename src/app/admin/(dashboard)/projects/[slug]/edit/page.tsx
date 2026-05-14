import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteProjectForm, ProjectForm } from "@/components/admin/project-form";
import { defaultsFromProject } from "@/lib/project-form-defaults";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ created?: string; saved?: string }>;
};

export default async function AdminEditProjectPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { created, saved } = await searchParams;

  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/projects" className="text-sm text-muted hover:text-foreground">
          ← All projects
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Edit project</h1>
        <p className="mt-2 font-mono text-xs text-muted">{project.slug}</p>
      </div>

      {created ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/25 px-4 py-2 text-sm text-emerald-200">
          Project created. Toggle <strong>Published</strong> when you are ready to show it on the site.
        </div>
      ) : null}
      {saved ? (
        <div className="rounded-xl border border-border bg-surface/40 px-4 py-2 text-sm text-muted">
          Saved.
        </div>
      ) : null}

      <ProjectForm mode="edit" projectId={project.id} defaults={defaultsFromProject(project)} />

      <div className="rounded-2xl border border-red-500/20 bg-bg-elevated/50 p-6">
        <h2 className="text-sm font-semibold text-red-200">Danger zone</h2>
        <p className="mt-2 text-xs text-muted">This removes the row from Postgres. There is no undo.</p>
        <div className="mt-4">
          <DeleteProjectForm projectId={project.id} label={project.name} />
        </div>
      </div>
    </div>
  );
}
