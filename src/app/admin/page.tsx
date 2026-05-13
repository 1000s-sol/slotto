export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Next: wallet allowlist in Postgres + Sign-in with Solana session gating. For now this is
          a navigation shell for upcoming CRUD screens.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href="/admin/projects"
          className="rounded-2xl border border-border bg-bg-elevated/70 p-6 transition hover:border-accent-purple/40"
        >
          <div className="text-lg font-semibold">Projects</div>
          <div className="mt-2 text-sm text-muted">Create / edit listings, banners, ME URL, review.</div>
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
