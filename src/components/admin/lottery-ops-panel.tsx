"use client";

import { BN } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";

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
import { createLotteryProgram } from "@/lib/lottery/program";
import type { LotteryDrawView } from "@/lib/lottery/chain";
import {
  ProjectTokenDrawAllocator,
  validateProjectTokenDrawSettings,
  type ProjectTokenDrawSettings,
} from "@/components/admin/project-token-draw-allocator";
import { fetchTickerPricesClient } from "@/lib/lottery/fetch-ticker-prices-client";
import { ensureTeamTokenAta } from "@/lib/lottery/ensure-team-token-ata";
import {
  projectTokensToSplMintDrafts,
  splMintDraftToOnChainArg,
} from "@/lib/lottery/project-tokens-for-draw";
import {
  adminFetchProjectTokensForDrawAction,
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
  | { kind: "error"; message: string };

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
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();

  const programId = useMemo(() => lotteryProgramId(), []);
  const globalConfig = useMemo(() => globalConfigPda(programId), [programId]);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [config, setConfig] = useState<GlobalConfigView | null>(null);
  const [initialized, setInitialized] = useState<boolean | null>(null);

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

  const refreshConfig = useCallback(async () => {
    if (!wallet) return;
    const program = createLotteryProgram(connection, wallet);
    const info = await connection.getAccountInfo(globalConfig);
    if (!info) {
      setInitialized(false);
      setConfig(null);
      return;
    }
    const cfg = await program.account.globalConfig.fetch(globalConfig);
    setInitialized(true);
    setConfig({
      authority: cfg.authority.toBase58(),
      teamVault: cfg.teamVault.toBase58(),
      buxVault: cfg.buxVault.toBase58(),
      setupVault: cfg.setupVault.toBase58(),
      nextDrawId: cfg.nextDrawId.toString(),
    });
  }, [connection, globalConfig, wallet]);

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
    if (!wallet || !publicKey) return;
    setPhase({ kind: "busy", label: "Initializing program…" });
    try {
      const program = createLotteryProgram(connection, wallet);
      const team = new PublicKey(teamVault.trim());
      const bux = new PublicKey(buxVault.trim());
      const setup = new PublicKey(setupVault.trim());
      const sig = await program.methods
        .initialize(team, bux, setup)
        .accounts({
          authority: publicKey,
          globalConfig,
        })
        .rpc();
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
    setupVault,
    teamVault,
    wallet,
  ]);

  const onCreateDraw = useCallback(async () => {
    if (!wallet || !publicKey || !config) return;
    if (liveDraw) {
      setPhase({
        kind: "error",
        message: `Draw #${liveDraw.drawId} is still active. Settle or finish it before creating a new draw.`,
      });
      return;
    }
    setPhase({ kind: "busy", label: "Creating draw…" });
    try {
      const program = createLotteryProgram(connection, wallet);
      const drawId = Number(config.nextDrawId);
      const draw = drawPda(programId, drawId);
      const prizeVault = prizeVaultPda(programId, draw);
      const ticketChunk0 = ticketChunkPda(programId, draw, 0);

      const openTs = parseDatetimeLocal(salesOpen);
      const closeTs = parseDatetimeLocal(salesClose);
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

      const tickerPrices = await fetchTickerPricesClient();
      const activeSpl = await projectTokensToSplMintDrafts(
        connection,
        tokens,
        tokenEnabled,
        tokenSettings,
        tickerPrices,
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

      const sig = await program.methods
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
        .rpc();

      for (const row of activeSpl) {
        setPhase({
          kind: "busy",
          label: `Ensuring team ATA for ${row.symbol}…`,
        });
        await ensureTeamTokenAta(
          connection,
          wallet,
          programId,
          new PublicKey(row.mint),
        );
      }

      if (activeSpl.length > 0) {
        await adminSaveSplRowsForDrawAction(drawId, activeSpl);
      }

      await refreshConfig();
      await onLiveDrawChange();
      setPhase({
        kind: "ok",
        message: `Draw #${drawId} created${activeSpl.length ? ` with ${activeSpl.length} SPL mint(s)` : ""}.`,
        signature: sig,
        draw: draw.toBase58(),
      });
    } catch (e) {
      setPhase({
        kind: "error",
        message: e instanceof Error ? e.message : "Create draw failed.",
      });
    }
  }, [
    config,
    connection,
    globalConfig,
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
    tokenSettings,
    wallet,
  ]);

  return (
    <div className="space-y-8">
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
          Global config PDA{" "}
          <span className="font-mono text-foreground">
            {globalConfig.toBase58().slice(0, 8)}…
          </span>
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
              <p className="text-sm text-muted">Not initialized on this cluster yet.</p>
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
                Create draw on devnet
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