import Link from "next/link";
import { BrandPng } from "@/components/brand-png";
import { SiteHeaderNav } from "@/components/site-header-nav";

export function SiteHeader() {
  return (
    <header className="relative z-[100] flex flex-row items-center justify-between gap-2 md:gap-4">
      <Link href="/" className="flex min-w-0 flex-1 items-center gap-3 bg-transparent pr-2">
        <BrandPng
          src="/brand/slotto-logo.png"
          alt="Slotto"
          width={320}
          height={86}
          className="h-12 w-auto max-h-12 max-w-full object-contain object-left sm:h-14 sm:max-h-14 md:h-24 md:max-h-none md:max-w-[480px]"
          priority
        />
      </Link>
      <SiteHeaderNav />
    </header>
  );
}
