import type { Metadata } from "next";
import Link from "next/link";
import { BrandPng } from "@/components/brand-png";
import { DiscordTicketBotButton } from "@/components/discord-ticket-bot-modal";
import { HomeLotterySection } from "@/components/home-lottery-section";
import { HomeDrawsSection } from "@/components/home-draws-section";
import { SlottoRadioDock, SlottoRadioProvider } from "@/components/slotto-radio";

export const metadata: Metadata = {
  title: "UI preview",
  robots: { index: false, follow: false },
};

const POINTS = [
  "Play our monthly lotto",
  "Enter with SOL or featured project tokens",
  "Find projects worth a closer look",
];

export default function DesignPreviewPage() {
  return (
    <SlottoRadioProvider>
      <div className="min-w-0 max-w-full space-y-20">
        <section>
          <div className="grid items-end gap-2 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,480px)] lg:gap-8">
            <div className="order-2 pb-2 lg:order-1 lg:pb-6">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-accent-gold">
                Monthly lottery on Solana
              </p>
              <h1 className="mt-4 max-w-xl text-5xl font-bold leading-[0.92] text-white sm:text-6xl lg:text-7xl">
                Welcome to Slotto
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted sm:text-xl">
                Supporting your favorite trusted and transparent Solana projects.
              </p>
              <ul className="mt-8 space-y-2.5">
                {POINTS.map((point) => (
                  <li
                    key={point}
                    className="border-l border-accent-gold/70 pl-3 text-sm leading-snug text-foreground/90"
                  >
                    {point}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/projects"
                  className="inline-flex rounded-full bg-accent-gold px-6 py-3 text-sm font-semibold text-bg-deep transition hover:brightness-110"
                >
                  Browse projects
                </Link>
                <DiscordTicketBotButton />
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="relative mx-auto w-full max-w-[440px]">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-[8%] bottom-[8%] top-[14%] rounded-full bg-[radial-gradient(circle_at_50%_42%,rgba(245,197,66,0.28),rgba(124,58,237,0.16)_46%,transparent_72%)] blur-2xl"
                />
                <BrandPng
                  src="/brand/slotto-guy.png"
                  alt="Slotto mascot"
                  width={640}
                  height={640}
                  priority
                  className="relative h-auto w-full object-contain"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 lg:mt-2">
            <SlottoRadioDock />
          </div>
        </section>

        <HomeLotterySection />
        <HomeDrawsSection />
      </div>
    </SlottoRadioProvider>
  );
}
