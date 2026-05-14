import Link from "next/link";

import { AdminSignInPanel } from "./sign-in-panel";
import { adminSecretConfigured } from "@/lib/admin-session";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function AdminLoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const nextPath = next?.startsWith("/") && !next.startsWith("//") ? next : "/admin";

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin sign-in</h1>
        <p className="mt-2 text-sm text-muted">
          Connect a wallet that is allowlisted in the database, then sign the message to open the
          admin dashboard.
        </p>
      </div>

      {!adminSecretConfigured() ? (
        <div className="rounded-xl border border-accent-gold/40 bg-surface/60 p-4 text-sm text-muted">
          Set <span className="font-mono text-foreground">ADMIN_DASHBOARD_SECRET</span> in{" "}
          <span className="font-mono">.env</span>, restart <span className="font-mono">npm run dev</span>
          , then reload this page.
        </div>
      ) : (
        <AdminSignInPanel nextPath={nextPath} />
      )}

      <Link href="/" className="block text-center text-sm text-muted hover:text-foreground">
        ← Back to site
      </Link>
    </div>
  );
}
