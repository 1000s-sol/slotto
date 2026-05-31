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
import { rootSiteMetadata } from "@/lib/site-metadata";

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

export const metadata: Metadata = rootSiteMetadata;

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
