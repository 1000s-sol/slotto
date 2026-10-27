import Link from "next/link";
import { BrandPng } from "@/components/brand-png";
import { SiteHeaderNav } from "@/components/site-header-nav";

export function SiteHeader() {
  return (
    <header className="relative z-[100] flex min-w-0 max-w-full flex-row items-center justify-between gap-2 py-2 leading-none sm:py-2.5 md:gap-4 md:py-0">
      <Link
        href="/"
        className="flex min-h-0 min-w-0 shrink items-center justify-start overflow-hidden bg-transparent pr-2 leading-none"
      >
        <BrandPng
          src="/brand/slotto-logo.png"
          alt="Slotto"
          width={320}
          height={86}
          className="block h-12 w-auto max-h-12 max-w-full object-contain object-left align-middle sm:h-14 sm:max-h-14 lg:h-16 lg:max-h-16 xl:h-24 xl:max-h-none xl:max-w-[420px]"
          priority
        />
      </Link>
      <SiteHeaderNav />
    </header>
  );
}
