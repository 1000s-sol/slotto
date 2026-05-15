"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

import { XSocialLink } from "@/components/x-social-link";
import { AdminNavLink } from "@/components/solana/admin-nav-link";
import { WalletConnectButton } from "@/components/solana/wallet-connect-button";

const links = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/contact", label: "Contact" },
];

const navLinkClass =
  "rounded-xl px-4 py-3 text-sm font-semibold text-muted transition hover:bg-surface hover:text-foreground";
const navLinkClassMobile =
  "block w-full rounded-xl px-4 py-3 text-left text-base font-semibold text-foreground transition hover:bg-surface/80";

function MenuIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

export function SiteHeaderNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { connected, disconnect } = useWallet();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="relative shrink-0">
      <div className="flex items-center justify-end gap-2 md:hidden">
        <div className="min-w-0 max-w-[min(100%,14rem)] sm:max-w-[18rem] [&>div]:min-w-0 [&>div]:justify-end">
          <WalletConnectButton variant="toolbar" />
        </div>
        <button
          type="button"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface/60 text-foreground transition hover:border-accent-purple/40 hover:bg-surface"
          aria-expanded={open}
          aria-controls="site-mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <MenuIcon open={open} />
        </button>
      </div>

      <nav
        className="hidden flex-wrap items-center justify-end gap-2 md:flex"
        aria-label="Main"
      >
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={navLinkClass}>
            {l.label}
          </Link>
        ))}
        <Link href="/profile" className={navLinkClass}>
          Profile
        </Link>
        <AdminNavLink className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted transition hover:border-accent-purple/50 hover:text-foreground" />
        <XSocialLink className="inline-flex items-center justify-center rounded-lg px-2 py-2 text-accent-cyan transition hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/50" />
        <WalletConnectButton />
      </nav>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-bg-deep/70 backdrop-blur-sm md:hidden"
            aria-label="Close menu"
            onClick={close}
          />
          <div
            id="site-mobile-nav"
            className="fixed left-3 right-3 top-[4.5rem] z-50 rounded-2xl border border-border bg-bg-elevated/98 p-2 shadow-xl shadow-black/40 md:hidden"
          >
            <div className="flex flex-col gap-0.5 py-1" role="navigation" aria-label="Mobile">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className={navLinkClassMobile} onClick={close}>
                  {l.label}
                </Link>
              ))}
              <Link href="/profile" className={navLinkClassMobile} onClick={close}>
                Profile
              </Link>
              <AdminNavLink className={navLinkClassMobile} onNavigate={close} />
              <a
                href="https://x.com/slottogg_"
                target="_blank"
                rel="noopener noreferrer"
                className={`${navLinkClassMobile} inline-flex items-center gap-2 text-accent-cyan`}
                onClick={close}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center" aria-hidden>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </span>
                Slotto on X
              </a>
              {connected ? (
                <button
                  type="button"
                  className={`${navLinkClassMobile} text-left text-muted hover:text-foreground`}
                  onClick={() => {
                    disconnect().catch(() => undefined);
                    close();
                  }}
                >
                  Disconnect wallet
                </button>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
