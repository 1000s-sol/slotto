import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { DiscordLogo } from "@/components/discord-logo";

const DISCORD_SUPPORT_URL = "https://discord.gg/eCnpuwNGkb";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Jackpot Sunday on X, Discord support for listings, draw tokens, and guest speaker requests.",
};

export default function ContactPage() {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-stretch lg:gap-10">
      <aside className="flex min-h-0 flex-col lg:h-full">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-border bg-bg-elevated/40 shadow-lg shadow-accent-purple/10 max-lg:flex-none lg:min-h-[220px] lg:flex-1 lg:aspect-auto">
          <Image
            src="/contact/jackpot-sunday.png"
            alt="Jackpot Sunday — weekly X Space"
            fill
            className="object-cover object-center"
            sizes="(max-width: 1024px) 100vw, 45vw"
            priority
          />
        </div>
      </aside>

      <div className="flex min-h-0 flex-col justify-center gap-8 lg:h-full">
        <div className="space-y-3 text-base leading-relaxed text-muted sm:text-lg">
          <p>
            Tune in to our weekly X Space every Sunday{" "}
            <span className="text-foreground">@ 2pm EST</span>.
          </p>
          <p>
            Hosted by{" "}
            <Link
              href="https://x.com/Josh_Hodlin"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent-cyan hover:underline"
            >
              Josh Hodlin
            </Link>{" "}
            and{" "}
            <Link
              href="https://x.com/BUXDAO"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent-cyan hover:underline"
            >
              BUXDAO
            </Link>
            .
          </p>
          <p>Guest founders, project updates, and crypto chat.</p>
        </div>

        <div className="space-y-5">
          <p className="text-base leading-relaxed text-muted sm:text-lg">
            To contact the team regarding any of the following, please open a ticket in
            the Slotto Discord support server:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-base text-muted sm:text-lg">
            <li>Apply to have your project listed on the platform</li>
            <li>Apply to have a token enabled in our monthly draws</li>
            <li>Request to be a guest speaker on an upcoming Sunday space</li>
          </ul>

          <a
            href={DISCORD_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 rounded-xl bg-[#5865F2] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#5865F2]/25 transition hover:brightness-110"
          >
            <DiscordLogo size={22} variant="white" />
            Support
          </a>

          <p className="max-w-xl text-sm italic leading-relaxed text-muted">
            Slotto discord support server is not an active community server and should
            only be used for project inquiries or customer/technical support. Slotto is
            not currently hiring or open to marketing proposals of any kind.
          </p>
        </div>
      </div>
    </div>
  );
}
