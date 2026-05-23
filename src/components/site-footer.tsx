import Link from "next/link";

import { XSocialLink } from "@/components/x-social-link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border pt-10 pb-2 text-center text-sm text-muted">
      <p className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span>© 2026 slotto.gg - All rights reserved</span>
        <span aria-hidden className="text-muted/50">
          ·
        </span>
        <Link href="/faq" className="text-muted transition hover:text-accent-cyan">
          FAQ
        </Link>
        <span aria-hidden className="text-muted/50">
          ·
        </span>
        <XSocialLink />
      </p>
    </footer>
  );
}
