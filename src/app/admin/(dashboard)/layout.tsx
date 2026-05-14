import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  adminSecretConfigured,
  currentAdminAddress,
} from "@/lib/admin-session";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!adminSecretConfigured()) {
    return (
      <div className="rounded-2xl border border-accent-gold/40 bg-bg-elevated/70 p-6 text-sm text-muted">
        <p className="font-semibold text-foreground">Admin is not configured</p>
        <p className="mt-2">
          Set <span className="font-mono">ADMIN_DASHBOARD_SECRET</span> in{" "}
          <span className="font-mono">.env</span> (at least 16 chars; e.g. <span className="font-mono">openssl rand -hex 32</span>),
          then restart the dev server.
        </p>
      </div>
    );
  }

  const address = await currentAdminAddress();
  if (!address) {
    const pathname = (await headers()).get("x-pathname") ?? "/admin";
    redirect(`/admin/login?next=${encodeURIComponent(pathname)}`);
  }

  const shortAddr = `${address.slice(0, 4)}…${address.slice(-4)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link href="/admin" className="font-medium text-foreground hover:text-accent-cyan">
            Admin home
          </Link>
          <span className="text-muted">·</span>
          <Link href="/admin/projects" className="text-muted hover:text-foreground">
            Projects
          </Link>
          <span className="text-muted">·</span>
          <Link href="/admin/lotteries" className="text-muted hover:text-foreground">
            Lotteries
          </Link>
          <span className="text-muted">·</span>
          <Link href="/projects" className="text-muted hover:text-foreground">
            Public listings
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <span title={address} className="font-mono text-xs text-muted">
            {shortAddr}
          </span>
          <form action="/admin/logout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-accent-purple/40 hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
      {children}
    </div>
  );
}
