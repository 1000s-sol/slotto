import Link from "next/link";
import { BrandPng } from "@/components/brand-png";
import { DiscordTicketBotButton } from "@/components/discord-ticket-bot-modal";
import { HomeLotterySection } from "@/components/home-lottery-section";
import { HomeDrawsSection } from "@/components/home-draws-section";
import { SlottoRadioDock, SlottoRadioProvider } from "@/components/slotto-radio";

function TicketIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-white xl:h-9 xl:w-9" fill="none" aria-hidden>
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v1.2a1.8 1.8 0 0 0 0 3.6v1.2A2.5 2.5 0 0 1 17.5 17h-11A2.5 2.5 0 0 1 4 14.5v-1.2a1.8 1.8 0 0 0 0-3.6V8.5Z"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <path d="M12 8.5v7" stroke="currentColor" strokeWidth="2.2" strokeDasharray="2 2" />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-white xl:h-9 xl:w-9" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7.25" stroke="currentColor" strokeWidth="2.2" />
      <path
        d="M12 8.2v7.6M9.4 10.1c.5-.8 1.4-1.2 2.6-1.2 1.5 0 2.5.7 2.5 1.8s-1 1.7-2.6 1.9-2.7.6-2.7 1.8 1.1 1.8 2.8 1.8c1.2 0 2.1-.4 2.6-1.1"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-white xl:h-9 xl:w-9" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7.25" stroke="currentColor" strokeWidth="2.2" />
      <path
        d="m14.8 9.2-1.1 4.5-4.5 1.1 1.1-4.5 4.5-1.1Z"
        stroke="currentColor"
        strokeWidth="2.2"
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

export function HomeScreen() {
  return (
    <SlottoRadioProvider>
      <div className="min-w-0 max-w-full space-y-20">
        <section>
          <div className="md:grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:items-stretch md:gap-x-4 lg:gap-x-8 xl:grid-cols-[minmax(0,1fr)_560px] xl:gap-x-10">
            <div className="relative z-10 min-w-0 md:col-start-1 md:row-start-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-gold">
                Monthly lotto game on Solana
              </p>
              <h1 className="mt-3 text-white">
                <span className="block text-base tracking-[0.18em] sm:text-lg">Welcome to</span>
                <span className="relative mt-3 block w-full max-w-[36rem] overflow-hidden [aspect-ratio:1955/482]">
                  <BrandPng
                    src="/brand/slotto-logo.png"
                    alt="Slotto"
                    width={2000}
                    height={1300}
                    priority
                    className="absolute left-[-1.84%] top-[-86.1%] h-[269.7%] w-[102.3%] max-w-none"
                  />
                </span>
              </h1>
              <p className="mt-4 text-lg leading-snug text-muted sm:text-xl">
                Supporting your favorite trusted
                <br />
                and transparent Solana projects.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-[minmax(0,1fr)_7.75rem] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_11rem] md:contents">
              <ul className="min-w-0 space-y-3 md:col-start-1 md:row-start-2 md:mt-7">
                {POINTS.map(({ text, icon: Icon }) => (
                  <li key={text} className="flex items-start gap-2 text-sm font-bold leading-snug text-white sm:gap-3 sm:text-base xl:items-center xl:gap-4 xl:text-2xl">
                    <Icon />
                    {text}
                  </li>
                ))}
              </ul>

              <div className="relative w-full md:col-start-2 md:row-span-3 md:row-start-1 md:mt-0 md:h-full md:min-h-0 md:w-full md:overflow-hidden xl:w-[560px] xl:overflow-visible">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-[8%] bottom-[8%] top-[14%] rounded-full bg-[radial-gradient(circle_at_50%_42%,rgba(245,197,66,0.28),rgba(124,58,237,0.16)_46%,transparent_72%)] blur-2xl"
                />
                <div className="contents md:absolute md:inset-0 md:flex md:items-end md:justify-center md:p-2 md:@container-size xl:contents">
                  <div className="contents md:relative md:block md:h-[min(100cqh,calc(100cqw*2592/3076))] md:w-[min(100cqw,calc(100cqh*3076/2592))] xl:contents">
                    <BrandPng
                      src="/brand/slotto-guy.png"
                      alt="Slotto mascot"
                      width={640}
                      height={640}
                      priority
                      className="relative h-auto w-full object-contain md:absolute md:left-[-6.014%] md:top-[-27.122%] md:h-[133.642%] md:w-[112.614%] md:max-w-none xl:inset-auto xl:bottom-[-7%] xl:right-0 xl:h-[134%] xl:w-auto"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-6 flex flex-wrap items-center gap-3 md:col-start-1 md:row-start-3 md:mt-8">
              <Link
                href="/projects"
                className="inline-flex h-11 items-center rounded-full bg-gradient-to-r from-accent-purple to-accent-blue px-6 text-sm font-semibold text-white shadow-md shadow-accent-purple/30 transition hover:brightness-110"
              >
                Browse projects
              </Link>
              <DiscordTicketBotButton />
            </div>
          </div>

          <div className="relative z-10 mt-8">
            <SlottoRadioDock />
          </div>
        </section>

        <HomeLotterySection />
        <HomeDrawsSection />
      </div>
    </SlottoRadioProvider>
  );
}
