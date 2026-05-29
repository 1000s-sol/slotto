"use client";

import { BN } from "@coral-xyz/anchor";
import {
  useAnchorWallet,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  lotteryCluster,
  lotteryClusterLabel,
  publicRpcClusterMismatch,
} from "@/lib/lottery/cluster";
import {
  lotteryProgramId,
  solscanAccountUrl,
  solscanTxUrl,
} from "@/lib/lottery/config";
import {
  drawPda,
  globalConfigPda,
  prizeVaultPda,
  ticketChunkPda,
} from "@/lib/lottery/pdas";
import {
  LOTTERY_BUX_VAULT,
  LOTTERY_SETUP_VAULT,
  LOTTERY_TEAM_VAULT,
} from "@/lib/lottery/recipients";
import { createLotteryProgram, createLotteryReadOnlyProgram } from "@/lib/lottery/program";
import type { LotteryDrawView } from "@/lib/lottery/chain";
import {
  ProjectTokenDrawAllocator,
  validateProjectTokenDrawSettings,
  type ProjectTokenDrawSettings,
} from "@/components/admin/project-token-draw-allocator";
import { ensureTeamTokenAta } from "@/lib/lottery/ensure-team-token-ata";
import { formatLotteryAdminError } from "@/lib/lottery/user-facing-error";
import { sendTransactionViaWallet } from "@/lib/lottery/wallet-send-transaction";
import { ProductionDomainBanner } from "@/components/lottery/production-domain-banner";
import { splMintDraftToOnChainArg } from "@/lib/lottery/project-tokens-for-draw";
import {
  adminBuildSplMintDraftsForCreateDrawAction,
  adminDrawExistsOnServerAction,
  adminFetchGlobalConfigAction,
  adminFetchProjectTokensForDrawAction,
  adminFetchServerLotteryClusterAction,
  adminMintsExistOnClusterAction,
  adminSaveSplRowsForDrawAction,
} from "@/app/admin/(dashboard)/lotteries/actions";

type LotteryOpsPanelProps = {
  liveDraw: LotteryDrawView | null;
  drawLoading: boolean;
  onLiveDrawChange: () => Promise<void>;
};

type GlobalConfigView = {
  authority: string;
  teamVault: string;
  buxVault: string;
  setupVault: string;
  nextDrawId: string;
};

type Phase =
  | { kind: "idle" }
  | { kind: "busy"; label: string }
  | { kind: "ok"; message: string; signature?: string; draw?: string }
  | { kind: "error"; message: string; signature?: string };

function datetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseDatetimeLocal(value: string): number {
  return Math.floor(new Date(value).getTime() / 1000);
}

export function LotteryOpsPanel({
  liveDraw,
  drawLoading,
  onLiveDrawChange,
}: LotteryOpsPanelProps) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();

  const programId = useMemo(() => lotteryProgramId(), []);
  const globalConfig = useMemo(() => globalConfigPda(programId), [programId]);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [config, setConfig] = useState<GlobalConfigView | null>(null);
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [serverClusterLabel, setServerClusterLabel] = useState<string | null>(
    null,
  );
  const [serverRpcEnvMismatch, setServerRpcEnvMismatch] = useState(false);

  const [teamVault, setTeamVault] = useState(LOTTERY_TEAM_VAULT);
  const [buxVault, setBuxVault] = useState(LOTTERY_BUX_VAULT);
  const [setupVault, setSetupVault] = useState(LOTTERY_SETUP_VAULT);

  const [salesOpen, setSalesOpen] = useState("");
  const [salesClose, setSalesClose] = useState("");
  const [seedSol, setSeedSol] = useState("0.05");
  const [seedRefund, setSeedRefund] = useState("");
  const [tokenEnabled, setTokenEnabled] = useState<Record<string, boolean>>({});
  const [tokenSettings, setTokenSettings] = useState<
    Record<string, ProjectTokenDrawSettings>
  >({});

  const cluster = lotteryCluster();
  const clusterLabel = lotteryClusterLabel(cluster);
  const rpcMismatch = publicRpcClusterMismatch();

  const refreshConfig = useCallback(async () => {
    if (!wallet) return;
    const [serverCluster, cfg] = await Promise.all([
      adminFetchServerLotteryClusterAction(),
      adminFetchGlobalConfigAction(),
    ]);
    setServerClusterLabel(serverCluster.label);
    setServerRpcEnvMismatch(serverCluster.rpcEnvMismatch);
    if (!cfg) {
      setInitialized(false);
      setConfig(null);
      return;
    }
    setInitialized(true);
    setConfig({
      authority: cfg.authority,
      teamVault: cfg.teamVault,
      buxVault: cfg.buxVault,
      setupVault: cfg.setupVault,
      nextDrawId: cfg.nextDrawId,
    });
  }, [wallet]);

  useEffect(() => {
    if (!wallet) {
      setInitialized(null);
      setConfig(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await refreshConfig();
      } catch (e) {
        if (cancelled) return;
        setPhase({
          kind: "error",
          message: e instanceof Error ? e.message : "Could not load global config.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshConfig, wallet]);

  useEffect(() => {
    if (!publicKey) return;
    setSeedRefund((v) => v || publicKey.toBase58());

    const now = new Date();
    setSalesOpen((v) => v || datetimeLocalValue(now));
    const close = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setSalesClose((v) => v || datetimeLocalValue(close));
  }, [publicKey]);

  const isOnChainAuthority = useMemo(() => {
    if (!config || !publicKey) return false;
    return config.authority === publicKey.toBase58();
  }, [config, publicKey]);

  const onInitialize = useCallback(async () => {
    if (!wallet || !publicKey || !sendTransaction) return;
    setPhase({ kind: "busy", label: "Confirm initialize in Phantom…" });
    try {
      const program = createLotteryProgram(connection, wallet);
      const team = new PublicKey(teamVault.trim());
      const bux = new PublicKey(buxVault.trim());
      const setup = new PublicKey(setupVault.trim());
      const sig = await sendTransactionViaWallet(connection, sendTransaction, () =>
        program.methods
          .initialize(team, bux, setup)
          .accounts({
            authority: publicKey,
            globalConfig,
          })
          .transaction(),
      );
      await refreshConfig();
      await onLiveDrawChange();
      setPhase({
        kind: "ok",
        message: "Global config initialized on-chain.",
        signature: sig,
      });
    } catch (e) {
      setPhase({
        kind: "error",
        message: e instanceof Error ? e.message : "Initialize failed.",
      });
    }
  }, [
    connection,
    globalConfig,
    publicKey,
    refreshConfig,
    onLiveDrawChange,
    sendTransaction,
    setupVault,
    teamVault,
    wallet,
  ]);

  const onCreateDraw = useCallback(async () => {
    if (!wallet || !publicKey || !sendTransaction) {
      setPhase({
        kind: "error",
        message: "Connect your authority wallet first.",
      });
      return;
    }
    if (!config) {
      setPhase({
        kind: "error",
        message:
          "Global config not loaded. Refresh the page or check LOTTERY_CLUSTER / Helius on Vercel.",
      });
      return;
    }
    if (!isOnChainAuthority) {
      setPhase({
        kind: "error",
        message: `Connected wallet is not the on-chain authority (${config.authority}).`,
      });
      return;
    }
    if (liveDraw) {
      setPhase({
        kind: "error",
        message: `Draw #${liveDraw.drawId} is still active. Settle or finish it before creating a new draw.`,
      });
      return;
    }
    if (!salesOpen.trim() || !salesClose.trim()) {
      setPhase({
        kind: "error",
        message: "Set sales open and close times.",
      });
      return;
    }

    setPhase({ kind: "busy", label: "Preparing draw (server)…" });
    try {
      const freshCfg = await adminFetchGlobalConfigAction();
      if (!freshCfg) {
        setPhase({
          kind: "error",
          message:
            "Server could not read global config on this cluster. Check LOTTERY_CLUSTER and HELIUS_API_KEY on Vercel.",
        });
        return;
      }
      const program = createLotteryProgram(connection, wallet);

      const openTs = parseDatetimeLocal(salesOpen);
      const closeTs = parseDatetimeLocal(salesClose);
      if (!Number.isFinite(openTs) || !Number.isFinite(closeTs)) {
        setPhase({ kind: "error", message: "Invalid sales open/close times." });
        return;
      }
      if (closeTs <= openTs) {
        setPhase({ kind: "error", message: "Sales close must be after sales open." });
        return;
      }

      const seedLamports = Math.floor(
        parseFloat(seedSol || "0") * LAMPORTS_PER_SOL,
      );
      if (!Number.isFinite(seedLamports) || seedLamports < 0) {
        setPhase({ kind: "error", message: "Invalid seed SOL amount." });
        return;
      }

      const refundKey = seedRefund.trim()
        ? new PublicKey(seedRefund.trim())
        : publicKey;

      setPhase({ kind: "busy", label: "Loading project tokens…" });
      const tokens = await adminFetchProjectTokensForDrawAction();
      const splErr = validateProjectTokenDrawSettings(
        tokens,
        tokenEnabled,
        tokenSettings,
      );
      if (splErr) {
        setPhase({ kind: "error", message: splErr });
        return;
      }

      setPhase({ kind: "busy", label: "Building SPL ticket rows…" });
      const activeSpl = await adminBuildSplMintDraftsForCreateDrawAction(
        tokenEnabled,
        tokenSettings,
      );
      setPhase({ kind: "busy", label: "Checking mints on cluster…" });
      const mintsOnCluster = await adminMintsExistOnClusterAction(
        activeSpl.map((r) => r.mint),
      );
      const splArgs = activeSpl.map((r) => {
        const arg = splMintDraftToOnChainArg(r);
        return {
          mint: new PublicKey(arg.mint),
          pricePerTicket: new BN(arg.pricePerTicket),
          mintDecimals: arg.mintDecimals,
          cap: arg.cap,
          pricingMode: arg.pricingMode,
        };
      });

      // Re-read next_draw_id after server prep so PDAs match chain (avoids stale UI / devnet id).
      const cfgBeforeSign = await adminFetchGlobalConfigAction();
      if (!cfgBeforeSign) {
        setPhase({
          kind: "error",
          message: "Could not re-read global config before signing. Refresh and try again.",
        });
        return;
      }
      setConfig({
        authority: cfgBeforeSign.authority,
        teamVault: cfgBeforeSign.teamVault,
        buxVault: cfgBeforeSign.buxVault,
        setupVault: cfgBeforeSign.setupVault,
        nextDrawId: cfgBeforeSign.nextDrawId,
      });

      const drawId = Number(cfgBeforeSign.nextDrawId);
      if (!Number.isFinite(drawId) || drawId < 0) {
        setPhase({ kind: "error", message: "Invalid next draw id from chain." });
        return;
      }

      const walletProgram = createLotteryReadOnlyProgram(connection);
      const walletCfg = await walletProgram.account.globalConfig.fetch(
        globalConfig,
      );
      const walletNextDrawId = Number(walletCfg.nextDrawId);
      if (walletNextDrawId !== drawId) {
        setPhase({
          kind: "error",
          message: `Wallet RPC says the next draw is #${walletNextDrawId}, but the server (Vercel LOTTERY_CLUSTER) says #${drawId}. Phantom must be on ${clusterLabel} and Vercel must use the same cluster — you cannot create draw #${drawId} on mainnet while the UI/server still reads devnet (next id 10).`,
        });
        return;
      }

      const draw = drawPda(programId, drawId);
      const prizeVault = prizeVaultPda(programId, draw);
      const ticketChunk0 = ticketChunkPda(programId, draw, 0);

      setPhase({
        kind: "busy",
        label: `Confirm create_draw #${drawId} in Phantom…`,
      });
      const sig = await sendTransactionViaWallet(connection, sendTransaction, () =>
        program.methods
          .createDraw(
            new BN(openTs),
            new BN(closeTs),
            refundKey,
            new BN(seedLamports),
            splArgs,
          )
          .accountsPartial({
            authority: publicKey,
            globalConfig,
            draw,
            prizeVault,
            ticketChunk0,
          })
          .transaction(),
      );

      const skippedTeamAta: string[] = [];
      for (const row of activeSpl) {
        const mintPk = new PublicKey(row.mint);
        if (!mintsOnCluster[row.mint]) {
          skippedTeamAta.push(row.symbol || row.mint.slice(0, 8));
          continue;
        }
        setPhase({
          kind: "busy",
          label: `Ensuring team ATA for ${row.symbol}…`,
        });
        await ensureTeamTokenAta(
          connection,
          wallet,
          programId,
          mintPk,
          sendTransaction,
        );
      }

      const existsOnServer = await adminDrawExistsOnServerAction(drawId);
      if (!existsOnServer) {
        setPhase({
          kind: "error",
          message: `Phantom confirmed a transaction, but draw #${drawId} is not on the server cluster (${serverClusterLabel ?? clusterLabel}). Open the tx on Solscan and check cluster; fix Vercel LOTTERY_CLUSTER / LOTTERY_RPC_URL and wallet network, then try again.`,
          signature: sig,
        });
        return;
      }

      if (activeSpl.length > 0) {
        await adminSaveSplRowsForDrawAction(drawId, activeSpl);
      }

      await refreshConfig();
      await onLiveDrawChange();
      const ataNote =
        skippedTeamAta.length > 0
          ? ` Team ATA skipped for ${skippedTeamAta.join(", ")} (mint not found on server RPC — usually devnet server + mainnet tokens; SPL buys disabled until cluster is mainnet).`
          : "";
      setPhase({
        kind: "ok",
        message: `Draw #${drawId} created on ${serverClusterLabel ?? clusterLabel}${activeSpl.length ? ` with ${activeSpl.length} SPL mint(s)` : ""}.${ataNote}`,
        signature: sig,
        draw: draw.toBase58(),
      });
    } catch (e) {
      const raw = formatLotteryAdminError(e);
      const lower = raw.toLowerCase();
      const hint =
        lower.includes("user rejected") || lower.includes("user declined")
          ? "Transaction cancelled in wallet."
          : lower.includes("disconnected port") ||
              lower.includes("service worker")
            ? "Phantom lost connection — refresh the page, reconnect the wallet, and try again."
            : null;
      setPhase({
        kind: "error",
        message: hint ? `${raw} ${hint}` : raw,
      });
    }
  }, [
    config,
    connection,
    globalConfig,
    isOnChainAuthority,
    liveDraw,
    programId,
    publicKey,
    refreshConfig,
    onLiveDrawChange,
    salesClose,
    salesOpen,
    seedRefund,
    seedSol,
    tokenEnabled,
    sendTransaction,
    serverClusterLabel,
    tokenSettings,
    wallet,
  ]);

  return (
    <div className="space-y-8">
      <ProductionDomainBanner />
      {serverRpcEnvMismatch ? (
        <p className="rounded-xl border border-red-500/60 bg-red-950/40 px-4 py-3 text-sm text-red-100">
          Server RPC cluster ({serverClusterLabel}) does not match LOTTERY_CLUSTER
          env ({clusterLabel}). Remove or fix{" "}
          <span className="font-mono">LOTTERY_RPC_URL</span> on Vercel — admin reads
          the wrong chain (wrong next draw id, SPL mints &quot;not on cluster&quot;).
        </p>
      ) : null}
      <div className="rounded-2xl border border-border bg-bg-elevated/70 p-6 text-sm">
        <p className="text-muted">
          Program{" "}
          <a
            href={solscanAccountUrl(programId.toBase58())}
            className="font-mono text-accent-cyan hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {programId.toBase58().slice(0, 8)}…
          </a>
        </p>
        <p className="mt-2 text-muted">
          Browser cluster{" "}
          <span className="font-mono text-foreground">{clusterLabel}</span>
          {serverClusterLabel && serverClusterLabel !== clusterLabel ? (
            <span className="text-amber-200/90">
              {" "}
              — server reads{" "}
              <span className="font-mono text-foreground">
                {serverClusterLabel}
              </span>{" "}
              (fix LOTTERY_CLUSTER / LOTTERY_RPC_URL on Vercel)
            </span>
          ) : serverClusterLabel ? (
            <span>
              {" "}
              · server{" "}
              <span className="font-mono text-foreground">
                {serverClusterLabel}
              </span>
            </span>
          ) : null}
          {rpcMismatch ? (
            <span className="text-amber-200/90">
              {" "}
              — wallet RPC does not match{" "}
              <span className="font-mono">NEXT_PUBLIC_LOTTERY_CLUSTER</span>; set{" "}
              <span className="font-mono">NEXT_PUBLIC_SOLANA_RPC_URL</span> to a{" "}
              {clusterLabel} endpoint or clear it.
            </span>
          ) : null}
        </p>
        <p className="mt-2 text-muted">
          Global config PDA{" "}
          <a
            href={solscanAccountUrl(globalConfig.toBase58())}
            className="font-mono text-accent-cyan hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {globalConfig.toBase58()}
          </a>
        </p>
      </div>

      {!connected || !wallet ? (
        <div className="rounded-2xl border border-border bg-bg-elevated/70 p-6">
          <p className="text-sm text-muted">
            Connect the wallet that will sign on-chain transactions (must match
            program authority after initialize).
          </p>
          <button
            type="button"
            onClick={() => setVisible(true)}
            className="mt-4 rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-2.5 text-sm font-semibold text-white"
          >
            Connect wallet
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-4 rounded-2xl border border-border bg-bg-elevated/70 p-6">
            <h2 className="text-lg font-semibold">1. Initialize (once per program)</h2>
            {initialized === false ? (
              <p className="text-sm text-muted">
                Not initialized on {clusterLabel} yet (or server RPC cannot read the
                account).
              </p>
            ) : initialized && config ? (
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">Authority</dt>
                  <dd className="break-all font-mono text-xs">{config.authority}</dd>
                </div>
                <div>
                  <dt className="text-muted">Next draw id</dt>
                  <dd className="font-mono">{config.nextDrawId}</dd>
                </div>
                <div>
                  <dt className="text-muted">Team vault</dt>
                  <dd className="break-all font-mono text-xs">{config.teamVault}</dd>
                </div>
                <div>
                  <dt className="text-muted">Setup vault</dt>
                  <dd className="break-all font-mono text-xs">{config.setupVault}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted">Loading…</p>
            )}

            {initialized === false ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Team vault (SOL + SPL)
                  <input
                    value={teamVault}
                    onChange={(e) => setTeamVault(e.target.value)}
                    className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  BUX project vault (SOL)
                  <input
                    value={buxVault}
                    onChange={(e) => setBuxVault(e.target.value)}
                    className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Setup vault (SOL)
                  <input
                    value={setupVault}
                    onChange={(e) => setSetupVault(e.target.value)}
                    className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground"
                  />
                </label>
                <button
                  type="button"
                  disabled={phase.kind === "busy"}
                  onClick={onInitialize}
                  className="rounded-xl border border-accent-gold/50 px-4 py-2.5 text-sm font-semibold text-accent-gold hover:bg-accent-gold/10 disabled:opacity-50 sm:col-span-2"
                >
                  Initialize on-chain
                </button>
              </div>
            ) : null}
          </div>

          {initialized && !drawLoading && !liveDraw ? (
            <div className="space-y-4 rounded-2xl border border-border bg-bg-elevated/70 p-6">
              <h2 className="text-lg font-semibold">Create draw</h2>
              {!isOnChainAuthority ? (
                <p className="rounded-xl border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
                  Connected wallet is not the on-chain authority. Switch to{" "}
                  <span className="font-mono">{config?.authority}</span> to create draws.
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Sales open (local time)
                  <input
                    type="datetime-local"
                    value={salesOpen}
                    onChange={(e) => setSalesOpen(e.target.value)}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Sales close (local time)
                  <input
                    type="datetime-local"
                    value={salesClose}
                    onChange={(e) => setSalesClose(e.target.value)}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Seed jackpot (SOL)
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={seedSol}
                    onChange={(e) => setSeedSol(e.target.value)}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Seed refund pubkey (empty draw)
                  <input
                    value={seedRefund}
                    onChange={(e) => setSeedRefund(e.target.value)}
                    placeholder={publicKey?.toBase58()}
                    className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground"
                  />
                </label>
              </div>

              <ProjectTokenDrawAllocator
                enabled={tokenEnabled}
                onEnabledChange={setTokenEnabled}
                settings={tokenSettings}
                onSettingsChange={setTokenSettings}
                disabled={phase.kind === "busy" || !isOnChainAuthority}
              />

              <p className="text-xs text-muted/90">
                Creating a draw also funds on-chain ticket storage (chunk 0, about 0.058 SOL
                rent from your admin wallet). Buyers only pay ticket price. For more than 256
                tickets, use init ticket chunk in ops before sales cross each chunk boundary.
              </p>

              <button
                type="button"
                disabled={phase.kind === "busy" || !isOnChainAuthority}
                onClick={onCreateDraw}
                className="rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create draw on {clusterLabel}
              </button>
            </div>
          ) : null}
        </>
      )}

      {phase.kind === "busy" ? (
        <p className="text-sm text-muted">{phase.label}</p>
      ) : null}
      {phase.kind === "ok" ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
          <p>{phase.message}</p>
          {phase.draw ? (
            <p className="mt-2">
              Draw{" "}
              <a
                href={solscanAccountUrl(phase.draw)}
                className="font-mono underline"
                target="_blank"
                rel="noreferrer"
              >
                {phase.draw.slice(0, 8)}…
              </a>
            </p>
          ) : null}
          {phase.signature ? (
            <p className="mt-1">
              <a
                href={solscanTxUrl(phase.signature)}
                className="underline"
                target="_blank"
                rel="noreferrer"
              >
                View transaction
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
      {phase.kind === "error" ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {phase.message}
        </div>
      ) : null}
    </div>
  );
}