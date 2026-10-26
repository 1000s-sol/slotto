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

export default function DesignPreviewPage() {
  return (
    <SlottoRadioProvider>
      <div className="min-w-0 max-w-full space-y-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent-gold/80">
          Design preview
        </p>
        <section className="grid min-w-0 max-w-full items-center gap-8 lg:grid-cols-[minmax(320px,460px)_minmax(0,1fr)] lg:gap-12">
          <div className="flex min-w-0 flex-col gap-3">
            <BrandPng
              src="/brand/slotto-guy.png"
              alt="Slotto mascot"
              width={480}
              height={480}
              priority
              className="mx-auto h-auto w-full max-w-[460px] object-contain"
            />
            <SlottoRadioDock />
          </div>
          <div className="preview-metal min-w-0 rounded-2xl p-4 backdrop-blur-md sm:p-8">
            <h1 className="text-balance text-3xl font-semibold leading-[1.1] text-accent-gold sm:text-4xl lg:text-5xl">
              Welcome to Slotto
            </h1>
            <p className="mt-4 w-full text-left text-2xl font-semibold leading-snug text-accent-gold hyphens-none sm:text-3xl lg:max-w-3xl lg:text-4xl">
              Supporting your favorite trusted and transparent Solana projects
            </p>
            <ul className="mt-6 list-disc space-y-2 pl-5 text-lg leading-relaxed text-muted sm:text-xl">
              <li>Play our monthly lotto</li>
              <li>Enter using Sol or featured project tokens</li>
              <li>Discover new projects and exciting investment opportunities</li>
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/projects"
                className="inline-flex rounded-xl border border-white/30 bg-gradient-to-b from-white/25 to-accent-gold/80 px-6 py-3 text-base font-semibold text-bg-deep shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition hover:brightness-110"
              >
                Browse projects
              </Link>
              <DiscordTicketBotButton />
            </div>
          </div>
        </section>

        <HomeLotterySection />

        <HomeDrawsSection />
      </div>
    </SlottoRadioProvider>
  );
}
