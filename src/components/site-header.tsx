import Link from "next/link";
import { BrandPng } from "@/components/brand-png";
import { XSocialLink } from "@/components/x-social-link";
import { AdminNavLink } from "@/components/solana/admin-nav-link";
import { WalletConnectButton } from "@/components/solana/wallet-connect-button";

const links = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="flex flex-col gap-4 bg-transparent sm:flex-row sm:items-center sm:justify-between">
      <Link href="/" className="flex items-center gap-3 bg-transparent">
        <BrandPng
          src="/brand/slotto-logo.png"
          alt="Slotto"
          width={320}
          height={86}
          className="h-16 w-auto max-w-[90vw] object-contain object-left sm:h-20 sm:max-w-[400px] md:h-24 md:max-w-[480px]"
          priority
        />
      </Link>
      <nav className="flex flex-wrap items-center gap-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface hover:text-foreground"
          >
            {l.label}
          </Link>
        ))}
        <Link
          href="/profile"
          className="rounded-lg px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface hover:text-foreground"
        >
          Profile
        </Link>
        <AdminNavLink className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted transition hover:border-accent-purple/50 hover:text-foreground" />
        <XSocialLink className="inline-flex items-center justify-center rounded-lg px-2 py-2 text-accent-cyan transition hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/50" />
        <WalletConnectButton />
      </nav>
    </header>
  );
}
