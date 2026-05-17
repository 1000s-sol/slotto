"use client";

import { BN } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  lotteryProgramId,
  solscanAccountUrl,
  solscanTxUrl,
} from "@/lib/lottery/config";
import { drawPda, globalConfigPda, prizeVaultPda } from "@/lib/lottery/pdas";
import { createLotteryProgram } from "@/lib/lottery/program";

type GlobalConfigView = {
  authority: string;
  teamVault: string;
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

export function LotteryOpsPanel() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();

  const programId = useMemo(() => lotteryProgramId(), []);
  const globalConfig = useMemo(() => globalConfigPda(programId), [programId]);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [config, setConfig] = useState<GlobalConfigView | null>(null);
  const [initialized, setInitialized] = useState<boolean | null>(null);

  const [teamVault, setTeamVault] = useState("");
  const [setupVault, setSetupVault] = useState("");

  const [salesOpen, setSalesOpen] = useState("");
  const [salesClose, setSalesClose] = useState("");
  const [seedSol, setSeedSol] = useState("0.05");
  const [seedRefund, setSeedRefund] = useState("");

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
    setTeamVault((v) => v || publicKey.toBase58());
    setSetupVault((v) => v || publicKey.toBase58());
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
      const setup = new PublicKey(setupVault.trim());
      const sig = await program.methods
        .initialize(team, setup)
        .accounts({
          authority: publicKey,
          globalConfig,
        })
        .rpc();
      await refreshConfig();
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
    setupVault,
    teamVault,
    wallet,
  ]);

  const onCreateDraw = useCallback(async () => {
    if (!wallet || !publicKey || !config) return;
    setPhase({ kind: "busy", label: "Creating draw…" });
    try {
      const program = createLotteryProgram(connection, wallet);
      const drawId = Number(config.nextDrawId);
      const draw = drawPda(programId, drawId);
      const prizeVault = prizeVaultPda(programId, draw);

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

      const sig = await program.methods
        .createDraw(
          new BN(openTs),
          new BN(closeTs),
          refundKey,
          new BN(seedLamports),
          [],
        )
        .accounts({
          authority: publicKey,
          globalConfig,
          draw,
          prizeVault,
        })
        .rpc();

      await refreshConfig();
      setPhase({
        kind: "ok",
        message: `Draw #${drawId} created.`,
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
    programId,
    publicKey,
    refreshConfig,
    salesClose,
    salesOpen,
    seedRefund,
    seedSol,
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
                  Team vault (SOL)
                  <input
                    value={teamVault}
                    onChange={(e) => setTeamVault(e.target.value)}
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

          <div className="space-y-4 rounded-2xl border border-border bg-bg-elevated/70 p-6">
            <h2 className="text-lg font-semibold">2. Create draw</h2>
            {initialized && config && !isOnChainAuthority ? (
              <p className="rounded-xl border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
                Connected wallet is not the on-chain authority. Switch to{" "}
                <span className="font-mono">{config.authority}</span> to create draws.
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

            <button
              type="button"
              disabled={
                phase.kind === "busy" || !initialized || !isOnChainAuthority
              }
              onClick={onCreateDraw}
              className="rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create draw on devnet
            </button>
          </div>
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