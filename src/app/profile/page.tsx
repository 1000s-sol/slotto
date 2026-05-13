import { ProfileWalletsSection } from "@/components/solana/profile-wallets-section";

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Next: Discord + X linking (Auth.js) and multi-wallet display. This page is a layout shell.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-bg-elevated/70 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Linked social</h2>
          <div className="mt-4 space-y-3 text-sm">
            <button
              type="button"
              className="w-full rounded-xl border border-border bg-surface/50 px-4 py-3 text-left font-medium text-foreground hover:border-accent-purple/40"
            >
              Connect Discord
            </button>
            <button
              type="button"
              className="w-full rounded-xl border border-border bg-surface/50 px-4 py-3 text-left font-medium text-foreground hover:border-accent-purple/40"
            >
              Connect X
            </button>
          </div>
        </section>

        <ProfileWalletsSection />
      </div>
    </div>
  );
}
