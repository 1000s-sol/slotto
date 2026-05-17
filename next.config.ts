import type { NextConfig } from "next";
import path from "node:path";

/** Peer deps of wallet packages sometimes fail to resolve from nested `node_modules`; pin to app root. */
const solanaWeb3Root = path.join(process.cwd(), "node_modules", "@solana", "web3.js");

/** @vercel/blob's browser shim — same export surface its server code needs (`fetch`). */
const vercelBlobUndiciShim = path.join(
  process.cwd(),
  "node_modules",
  "@vercel/blob",
  "dist",
  "undici-browser.js",
);

const nextConfig: NextConfig = {
  serverExternalPackages: ["@vercel/blob"],
  /** ESLint plugin resolution can differ on Vercel; `next build` still runs TypeScript. */
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: [
    "@coral-xyz/anchor",
    "@noble/curves",
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-wallets",
    "buffer",
  ],
  turbopack: {
    resolveAlias: {
      "@solana/web3.js": solanaWeb3Root,
    },
  },
  webpack: (config, { isServer }) => {
    const alias: Record<string, string | string[] | boolean> = {
      ...config.resolve.alias,
      "@solana/web3.js": solanaWeb3Root,
    };
    // Server actions pull @vercel/blob into a client analysis graph; real `undici` is Node-only and
    // can resolve to a broken/partial install. Use Vercel's fetch shim in the browser bundle.
    if (!isServer) {
      alias.undici = vercelBlobUndiciShim;
    }
    config.resolve.alias = alias;
    return config;
  },
};

export default nextConfig;
