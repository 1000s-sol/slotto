import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PriceTicker } from "@/components/price-ticker";
import { SolanaWalletProvider } from "@/components/solana/solana-wallet-provider";

const zenDots = localFont({
  src: "../fonts/ZenDots-Regular.ttf",
  variable: "--font-zen-dots",
  display: "swap",
  weight: "400",
});

const michroma = localFont({
  src: "../fonts/Michroma-Regular.ttf",
  variable: "--font-michroma",
  display: "swap",
  weight: "400",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://slotto.gg";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Slotto — Solana NFT reviews & monthly lottery",
    template: "%s · Slotto",
  },
  description:
    "Curated, transparent Solana NFT project reviews and a monthly lottery experience.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Slotto",
    title: "Slotto — Solana NFT reviews & monthly lottery",
    description:
      "Curated, transparent Solana NFT project reviews and a monthly lottery experience.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Slotto.gg — Solana NFT reviews and monthly lottery",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Slotto — Solana NFT reviews & monthly lottery",
    description:
      "Curated, transparent Solana NFT project reviews and a monthly lottery experience.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${zenDots.variable} ${michroma.variable} ${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <SolanaWalletProvider>
          <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pb-8 pt-4 sm:px-6">
            <SiteHeader />
            <PriceTicker />
            <main className="mt-8 flex-1">{children}</main>
            <SiteFooter />
          </div>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
