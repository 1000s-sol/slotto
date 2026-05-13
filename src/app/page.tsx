import Link from "next/link";
import { BrandPng } from "@/components/brand-png";
import { HomeLotterySection } from "@/components/home-lottery-section";

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-8 lg:grid-cols-[minmax(280px,440px)_1fr] lg:gap-10">
        <div className="relative flex justify-center bg-transparent py-4 lg:justify-start lg:py-0">
          <BrandPng
            src="/brand/slotto-guy.png"
            alt="Slotto mascot"
            width={480}
            height={480}
            priority
            className="h-auto w-full max-w-[min(100%,340px)] object-contain sm:max-w-[400px] md:max-w-[440px]"
          />
        </div>
        <div className="rounded-2xl border border-border bg-bg-elevated/55 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset] backdrop-blur-md">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-accent-gold sm:text-4xl lg:text-5xl">
            Welcome to Slotto
          </h1>
          <p className="mt-4 max-w-2xl text-balance text-xl font-semibold leading-snug text-accent-gold sm:text-2xl lg:text-3xl">
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
    </div>
  );
}
