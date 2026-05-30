import { XSocialLink } from "@/components/x-social-link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border pt-10 pb-2 text-center text-sm text-muted">
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span>© 2026 slotto.gg</span>
        <span aria-hidden className="hidden text-muted/50 sm:inline">
          -
        </span>
        <span className="flex w-full items-center justify-center gap-x-2 sm:w-auto">
          <span>All rights reserved</span>
          <span aria-hidden className="text-muted/50">
            ·
          </span>
          <XSocialLink />
        </span>
      </p>
    </footer>
  );
}
