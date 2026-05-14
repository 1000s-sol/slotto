export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Projects are stored in Postgres. Add listings under{" "}
          <span className="text-foreground">Projects</span>, then mark them published to show on
          the public directory.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href="/admin/projects"
          className="rounded-2xl border border-border bg-bg-elevated/70 p-6 transition hover:border-accent-purple/40"
        >
          <div className="text-lg font-semibold">Projects</div>
          <div className="mt-2 text-sm text-muted">Create / edit listings, review copy, links, publish.</div>
        </a>
        <a
          href="/admin/lotteries"
          className="rounded-2xl border border-border bg-bg-elevated/70 p-6 transition hover:border-accent-purple/40"
        >
          <div className="text-lg font-semibold">Lotteries</div>
          <div className="mt-2 text-sm text-muted">
            One active lottery at a time; blocked while a draw is running.
          </div>
        </a>
      </div>
    </div>
  );
}
