import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import { MaintenanceGate } from "@/components/maintenance-gate";
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
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://slotto.gg";

const shareImage = "/brand/slotto-tickets.png";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Slotto V2 is coming",
    template: "%s · Slotto",
  },
  description:
    "Working on improvements and upgrades. slotto.gg will be back soon.",
  openGraph: {
    type: "website",
    siteName: "Slotto",
    title: "Slotto V2 is coming",
    description:
      "Working on improvements and upgrades. slotto.gg will be back soon.",
    images: [
      {
        url: shareImage,
        width: 1254,
        height: 1254,
        alt: "Slotto — monthly lottery on Solana",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Slotto V2 is coming",
    description:
      "Working on improvements and upgrades. slotto.gg will be back soon.",
    images: [shareImage],
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
          <AuthSessionProvider>
          <MaintenanceGate>
            <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pb-8 pt-4 sm:px-6">
            <SiteHeader />
            <PriceTicker />
            <main className="mt-8 flex-1">{children}</main>
            <SiteFooter />
            </div>
          </MaintenanceGate>
          </AuthSessionProvider>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
