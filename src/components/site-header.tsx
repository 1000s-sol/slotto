import Link from "next/link";
import { BrandPng } from "@/components/brand-png";
import { SiteHeaderNav } from "@/components/site-header-nav";

export function SiteHeader() {
  return (
    <header className="relative z-[100] flex flex-col gap-4 bg-transparent md:flex-row md:items-center md:justify-between">
      <Link href="/" className="flex shrink-0 items-center gap-3 bg-transparent">
        <BrandPng
          src="/brand/slotto-logo.png"
          alt="Slotto"
          width={320}
          height={86}
          className="h-14 w-auto max-w-[min(100%,18rem)] object-contain object-left sm:h-16 sm:max-w-[22rem] md:h-24 md:max-w-[480px]"
          priority
        />
      </Link>
      <SiteHeaderNav />
    </header>
  );
}
