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
        <div className="min-w-0 rounded-2xl border border-border bg-bg-elevated/55 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset] backdrop-blur-md sm:p-8">
          <h1 className="flex min-w-0 items-center gap-2 text-2xl font-semibold tracking-tight text-accent-gold sm:gap-3 sm:text-3xl lg:gap-0 lg:text-5xl">
            <span
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center sm:h-16 sm:w-16 lg:hidden"
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
            <span className="min-w-0 text-balance leading-tight">Welcome to Slotto</span>
          </h1>
          <p className="mt-4 w-full text-justify text-xl font-semibold leading-snug text-accent-gold hyphens-auto [text-wrap:pretty] sm:text-2xl lg:max-w-2xl lg:text-balance lg:text-left lg:text-3xl">
            Supporting your favorite trusted and transparent Solana projects
          </p>
          <ul className="mt-6 list-disc space-y-2 pl-5 text-base text-muted sm:text-lg">
            <li>Play our monthly lotto</li>
            <li>Enter using Sol or featured project tokens</li>
            <li>Discover new projects and exciting investment opportunities</li>
          </ul>
          <div className="mt-8">
            <Link
              href="/projects"
              className="inline-flex rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-accent-purple/25 transition hover:brightness-110"
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
