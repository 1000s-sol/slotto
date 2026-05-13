export default function AdminProjectsPage() {
  return (
    <div className="space-y-4">
      <a href="/admin" className="text-sm text-muted hover:text-foreground">
        ← Admin home
      </a>
      <h1 className="text-2xl font-semibold">Projects (admin)</h1>
      <p className="text-sm text-muted">
        Coming next: create/edit form with Markdown preview, banner upload/URL, ME URL parser,
        marketplace links list, optional token mint, slug auto + override.
      </p>
    </div>
  );
}
