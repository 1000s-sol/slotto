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

function TicketIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v1.2a1.8 1.8 0 0 0 0 3.6v1.2A2.5 2.5 0 0 1 17.5 17h-11A2.5 2.5 0 0 1 4 14.5v-1.2a1.8 1.8 0 0 0 0-3.6V8.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M12 8.5v7" stroke="currentColor" strokeWidth="1.7" strokeDasharray="2 2" />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7.25" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 8.2v7.6M9.4 10.1c.5-.8 1.4-1.2 2.6-1.2 1.5 0 2.5.7 2.5 1.8s-1 1.7-2.6 1.9-2.7.6-2.7 1.8 1.1 1.8 2.8 1.8c1.2 0 2.1-.4 2.6-1.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7.25" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m14.8 9.2-1.1 4.5-4.5 1.1 1.1-4.5 4.5-1.1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const POINTS = [
  { text: "Play our monthly lotto", icon: TicketIcon },
  { text: "Enter with SOL or featured project tokens", icon: CoinIcon },
  { text: "Find projects worth a closer look", icon: CompassIcon },
];

export default function DesignPreviewPage() {
  return (
    <SlottoRadioProvider>
      <div className="min-w-0 max-w-full space-y-20">
        <section>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-center lg:gap-10">
            <div className="order-2 w-full lg:order-1 lg:w-[40rem] lg:shrink-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-gold">
                Monthly lotto game on Solana
              </p>
              <h1 className="mt-3 text-[2.75rem] font-extrabold leading-[0.92] text-white sm:text-[3.35rem] lg:whitespace-nowrap lg:text-[3.85rem]">
                Welcome to Slotto
              </h1>
              <p className="mt-4 max-w-[34rem] text-lg leading-snug text-muted sm:text-xl">
                Supporting your favorite trusted
                <br className="hidden sm:block" /> and transparent Solana projects.
              </p>
              <ul className="mt-7 space-y-3">
                {POINTS.map(({ text, icon: Icon }) => (
                  <li key={text} className="flex items-center gap-3 text-base text-foreground">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-gold/15 text-accent-gold">
                      <Icon />
                    </span>
                    {text}
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

            <div className="relative order-1 mx-auto w-full max-w-[420px] shrink-0 lg:order-2 lg:mx-0 lg:w-[400px]">
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

          <div className="mt-2 lg:-mt-4">
            <SlottoRadioDock />
          </div>
        </section>

        <HomeLotterySection />
        <HomeDrawsSection />
      </div>
    </SlottoRadioProvider>
  );
}
