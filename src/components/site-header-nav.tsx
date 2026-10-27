"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

import { XSocialLink } from "@/components/x-social-link";
import { AdminNavLink } from "@/components/solana/admin-nav-link";
import { WalletConnectButton } from "@/components/solana/wallet-connect-button";

const links = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/projects", label: "Projects", icon: "projects" },
  { href: "/buyback", label: "Buyback", icon: "buyback" },
  { href: "/faq", label: "FAQ", icon: "faq" },
  { href: "/contact", label: "Contact", icon: "contact" },
] as const;

const navLinkClass =
  "rounded-xl px-2 py-2 text-sm font-semibold text-muted transition hover:bg-surface hover:text-foreground xl:px-4 xl:py-3";
const navLinkClassMobile =
  "flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-left text-base font-semibold text-white transition hover:bg-white/12";

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

function NavGlyph({ name }: { name: "home" | "projects" | "buyback" | "faq" | "contact" | "profile" | "admin" | "wallet" | "x" }) {
  const className =
    name === "x" ? "h-5 w-5 shrink-0 text-white" : "h-5 w-5 shrink-0 text-accent-gold";
  if (name === "x") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      {name === "home" ? (
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      ) : null}
      {name === "projects" ? (
        <>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
          <path d="m15.2 8.8-1.2 4.4-4.4 1.2 1.2-4.4 4.4-1.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </>
      ) : null}
      {name === "buyback" ? (
        <>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8v8M9.6 9.8c.4-.7 1.2-1.1 2.4-1.1 1.4 0 2.2.6 2.2 1.6s-.9 1.5-2.4 1.7-2.4.5-2.4 1.6 1 1.6 2.5 1.6c1 0 1.8-.3 2.3-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      ) : null}
      {name === "faq" ? (
        <>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9.6 9.6a2.4 2.4 0 1 1 3.2 2.3c-.7.3-1.3.9-1.3 1.6V14.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="17" r="0.9" fill="currentColor" />
        </>
      ) : null}
      {name === "contact" ? (
        <>
          <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="m4.5 7.5 7.5 5.5 7.5-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </>
      ) : null}
      {name === "profile" ? (
        <>
          <circle cx="12" cy="8.2" r="3.1" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5.6 19.2c1.2-2.8 3.4-4.2 6.4-4.2s5.2 1.4 6.4 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      ) : null}
      {name === "admin" ? (
        <path d="M12 3.5 19 6.2v5.3c0 4.2-2.8 7.2-7 8.9-4.2-1.7-7-4.7-7-8.9V6.2L12 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      ) : null}
      {name === "wallet" ? (
        <>
          <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="16.5" cy="14.5" r="1" fill="currentColor" />
        </>
      ) : null}
    </svg>
  );
}

function itemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeaderNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { connected, disconnect } = useWallet();
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-center lg:block">
      <div className="flex items-center justify-end gap-2 lg:hidden">
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
        className="hidden flex-wrap items-center justify-end gap-1 lg:flex xl:gap-2"
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
        <div
          id="site-mobile-nav"
          role="menu"
          className="absolute right-0 top-full z-[140] mt-3 w-[min(22rem,calc(100vw-2.75rem))] rounded-xl border-2 border-[#c5ddff]/80 bg-gradient-to-b from-[#1d5ed4] to-[#14398f] p-3 text-left shadow-[0_16px_40px_rgba(6,20,56,0.55)] lg:hidden"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              role="menuitem"
              className={`${navLinkClassMobile} ${itemActive(pathname, l.href) ? "bg-white/15" : ""}`}
              onClick={close}
            >
              <NavGlyph name={l.icon} />
              {l.label}
            </Link>
          ))}
          <Link
            href="/profile"
            role="menuitem"
            className={`${navLinkClassMobile} ${itemActive(pathname, "/profile") ? "bg-white/15" : ""}`}
            onClick={close}
          >
            <NavGlyph name="profile" />
            Profile
          </Link>
          <AdminNavLink
            className={navLinkClassMobile}
            onNavigate={close}
            icon={<NavGlyph name="admin" />}
          />
          <a
            href="https://x.com/slottogg_"
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            className={navLinkClassMobile}
            onClick={close}
          >
            <NavGlyph name="x" />
            Slotto on X
          </a>
          {connected ? (
            <button
              type="button"
              role="menuitem"
              className={`${navLinkClassMobile} mt-2 border-t border-[#c5ddff]/45 pt-3`}
              onClick={() => {
                disconnect().catch(() => undefined);
                close();
              }}
            >
              <NavGlyph name="wallet" />
              Disconnect wallet
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
