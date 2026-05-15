import Link from "next/link";
import { BrandPng } from "@/components/brand-png";
import { SiteHeaderNav } from "@/components/site-header-nav";

export function SiteHeader() {
  return (
    <header className="relative z-[100] flex flex-row items-center justify-between gap-2 py-2 leading-none sm:py-2.5 md:gap-4 md:py-0">
      <Link
        href="/"
        className="flex min-h-0 min-w-0 flex-1 items-center justify-start bg-transparent pr-2 leading-none"
      >
        <BrandPng
          src="/brand/slotto-logo.png"
          alt="Slotto"
          width={320}
          height={86}
          className="block h-12 w-auto max-h-12 max-w-full object-contain object-left align-middle sm:h-14 sm:max-h-14 md:h-24 md:max-h-none md:max-w-[480px]"
          priority
        />
      </Link>
      <SiteHeaderNav />
    </header>
  );
}
