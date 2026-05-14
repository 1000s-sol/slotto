import Link from "next/link";

import { ProjectForm } from "@/components/admin/project-form";

export default function AdminNewProjectPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/projects" className="text-sm text-muted hover:text-foreground">
          ← All projects
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">New project</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Fill in the listing. You can save as a draft and publish later from the edit screen.
        </p>
      </div>

      <ProjectForm mode="create" />
    </div>
  );
}
