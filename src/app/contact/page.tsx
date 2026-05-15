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
    <div className="space-y-10">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-10">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-bg-elevated/40 shadow-lg shadow-accent-purple/10">
          <Image
            src="/contact/jackpot-sunday.png"
            alt="Jackpot Sunday — weekly X Space"
            width={1024}
            height={1024}
            className="h-auto w-full object-cover object-center"
            sizes="(max-width: 1024px) 100vw, 45vw"
            priority
          />
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Contact
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
              Tune in to our weekly X Space every Sunday <span className="text-foreground">@ 2pm EST</span>.
            </p>
            <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">
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
            <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">
              Guest founders, project updates, and crypto chat.
            </p>
          </div>

          <ContactApplicationForm />
        </div>
      </div>
    </div>
  );
}
