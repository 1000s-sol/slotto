import Link from "next/link";
import { BrandPng } from "@/components/brand-png";
import { HomeLotterySection } from "@/components/home-lottery-section";
import { HomeDrawsSection } from "@/components/home-draws-section";

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-6 lg:grid-cols-[minmax(280px,440px)_1fr] lg:gap-10">
        <div className="relative hidden justify-center bg-transparent py-0 lg:flex lg:justify-start">
          <BrandPng
            src="/brand/slotto-guy.png"
            alt="Slotto mascot"
            width={480}
            height={480}
            priority
            className="h-auto w-full max-w-[min(100%,440px)] object-contain"
          />
        </div>
        <div className="min-w-0 rounded-2xl border border-border bg-bg-elevated/55 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset] backdrop-blur-md sm:p-8">
          <h1 className="flex min-w-0 flex-row items-center gap-3 text-3xl font-semibold tracking-tight text-accent-gold sm:gap-4 sm:text-4xl lg:block lg:text-5xl lg:leading-tight">
            <span className="min-w-0 flex-1 text-balance leading-[1.1] lg:block lg:w-full lg:flex-none">Welcome to Slotto</span>
            <span
              className="inline-flex h-28 w-28 shrink-0 items-center justify-center sm:h-36 sm:w-36 lg:hidden"
              aria-hidden
            >
              <BrandPng
                src="/brand/slotto-guy.png"
                alt=""
                width={256}
                height={256}
                priority
                className="h-full w-full max-h-full max-w-full object-contain"
              />
            </span>
          </h1>
          <p className="mt-4 w-full text-left text-2xl font-semibold leading-snug text-accent-gold hyphens-none sm:text-3xl lg:max-w-2xl lg:text-3xl">
            Supporting your favorite trusted and transparent Solana projects
          </p>
          <ul className="mt-6 list-disc space-y-2 pl-5 text-lg leading-relaxed text-muted sm:text-xl lg:text-lg">
            <li>Play our monthly lotto</li>
            <li>Enter using Sol or featured project tokens</li>
            <li>Discover new projects and exciting investment opportunities</li>
          </ul>
          <div className="mt-8">
            <Link
              href="/projects"
              className="inline-flex rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-6 py-3 text-base font-medium text-white shadow-lg shadow-accent-purple/25 transition hover:brightness-110 lg:px-5 lg:py-2.5 lg:text-sm"
            >
              Browse projects
            </Link>
          </div>
        </div>
      </section>

      <HomeLotterySection />

      <HomeDrawsSection />
    </div>
  );
}
