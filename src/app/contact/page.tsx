import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ContactApplicationForm } from "@/components/contact/contact-application-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Jackpot Sunday on X, guest spots, and Slotto.gg listing applications.",
};

export default function ContactPage() {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-stretch lg:gap-10">
      <aside className="flex min-h-0 flex-col gap-5 lg:h-full">
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

        <div className="shrink-0 space-y-3 text-base leading-relaxed text-muted sm:text-lg">
          <p>
            Tune in to our weekly X Space every Sunday <span className="text-foreground">@ 2pm EST</span>.
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
      </aside>

      <div className="flex min-h-0 flex-col lg:h-full">
        <ContactApplicationForm className="min-h-0 flex-1" />
      </div>
    </div>
  );
}
