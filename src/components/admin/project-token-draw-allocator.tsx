"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  adminFetchProjectTokensForDrawAction,
  adminPreviewLiquidTicketPricesAction,
} from "@/app/admin/(dashboard)/lotteries/actions";
import type { LiquidTicketPricePreview } from "@/lib/lottery/preview-liquid-ticket-prices";
import type { ProjectTokenForDraw } from "@/lib/lottery/project-tokens-for-draw";
import { SPL_MINT_MAX_ON_CHAIN } from "@/lib/lottery/spl-types";

export type ProjectTokenDrawSettings = {
  onChainCap: number;
  displayCap: number;
  published: boolean;
  priceUi: string;
};

const DEFAULT_SETTINGS: ProjectTokenDrawSettings = {
  onChainCap: 500,
  displayCap: 60,
  published: true,
  priceUi: "1",
};

export type ProjectTokenDrawAllocatorProps = {
  enabled: Record<string, boolean>;
  onEnabledChange: Dispatch<SetStateAction<Record<string, boolean>>>;
  settings: Record<string, ProjectTokenDrawSettings>;
  onSettingsChange: Dispatch<SetStateAction<Record<string, ProjectTokenDrawSettings>>>;
  disabled?: boolean;
};

export function ProjectTokenDrawAllocator({
  enabled,
  onEnabledChange,
  settings,
  onSettingsChange,
  disabled,
}: ProjectTokenDrawAllocatorProps) {
  const [tokens, setTokens] = useState<ProjectTokenForDraw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liquidPreviews, setLiquidPreviews] = useState<
    Record<string, LiquidTicketPricePreview>
  >({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await adminFetchProjectTokensForDrawAction();
      setTokens(list);
      onEnabledChange((prev) => {
        const next = { ...prev };
        for (const t of list) {
          if (next[t.mint] === undefined) next[t.mint] = false;
        }
        return next;
      });
      onSettingsChange((prev) => {
        const next = { ...prev };
        for (const t of list) {
          if (!next[t.mint]) next[t.mint] = { ...DEFAULT_SETTINGS };
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load project tokens.");
    } finally {
      setLoading(false);
    }
  }, [onEnabledChange, onSettingsChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const enabledLiquidMints = tokens
    .filter((t) => t.liquid && enabled[t.mint])
    .map((t) => t.mint)
    .sort()
    .join(",");

  useEffect(() => {
    if (!enabledLiquidMints) {
      setLiquidPreviews({});
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    const mints = enabledLiquidMints.split(",");
    void adminPreviewLiquidTicketPricesAction(mints)
      .then((rows) => {
        if (cancelled) return;
        const map: Record<string, LiquidTicketPricePreview> = {};
        for (const r of rows) map[r.mint] = r;
        setLiquidPreviews(map);
      })
      .catch((e) => {
        if (!cancelled) {
          setLiquidPreviews({});
          setPreviewError(
            e instanceof Error ? e.message : "Could not load live prices.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabledLiquidMints]);

  const enabledCount = tokens.filter((t) => enabled[t.mint]).length;

  const patchSettings = (mint: string, patch: Partial<ProjectTokenDrawSettings>) => {
    onSettingsChange({
      ...settings,
      [mint]: { ...(settings[mint] ?? DEFAULT_SETTINGS), ...patch },
    });
  };

  if (loading) {
    return <p className="text-sm text-muted">Loading published project tokens…</p>;
  }

  if (error) {
    return (
      <p className="rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
        {error}
      </p>
    );
  }

  if (tokens.length === 0) {
    return (
      <p className="text-sm text-muted">
        No published projects with a token mint. Add tokens on project listings first.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          Project tokens ({enabledCount}/{SPL_MINT_MAX_ON_CHAIN} enabled)
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void load()}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground disabled:opacity-50"
        >
          Refresh list
        </button>
      </div>

      <p className="text-xs text-muted">
        Liquid tokens use a live quote (~95% of 0.01 SOL, same feed as the site ticker).
        On mainnet, SPL tickets require the mint on-chain. Fixed tokens need a manual price
        per ticket.
      </p>
      {previewError ? (
        <p className="text-xs text-amber-200/90">{previewError}</p>
      ) : null}

      <div className="space-y-2">
        {tokens.map((t) => {
          const on = Boolean(enabled[t.mint]);
          const s = settings[t.mint] ?? DEFAULT_SETTINGS;
          return (
            <div
              key={t.mint}
              className="rounded-xl border border-border bg-surface/40 p-4"
            >
              <div className="flex flex-wrap items-start gap-3">
                {t.tokenImageUrl ? (
                  <Image
                    src={t.tokenImageUrl}
                    alt=""
                    width={36}
                    height={36}
                    className="rounded-lg"
                    unoptimized
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={
                        disabled ||
                        (!on && enabledCount >= SPL_MINT_MAX_ON_CHAIN)
                      }
                      onChange={(e) =>
                        onEnabledChange({
                          ...enabled,
                          [t.mint]: e.target.checked,
                        })
                      }
                    />
                    {t.tokenName ?? t.projectName}
                    {t.liquid ? (
                      <span className="rounded bg-accent-cyan/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent-cyan">
                        Liquid · dynamic price
                      </span>
                    ) : (
                      <span className="rounded bg-border px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">
                        Fixed price
                      </span>
                    )}
                  </label>
                  <p className="mt-0.5 text-xs text-muted">{t.projectName}</p>
                  <p className="mt-1 break-all font-mono text-[10px] text-muted/80">
                    {t.mint}
                  </p>
                </div>
              </div>

              {on ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {!t.liquid ? (
                    <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
                      Price per ticket (token amount)
                      <input
                        value={s.priceUi}
                        disabled={disabled}
                        onChange={(e) =>
                          patchSettings(t.mint, { priceUi: e.target.value })
                        }
                        className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                      />
                    </label>
                  ) : (
                    <div className="text-xs text-muted sm:col-span-2">
                      <p>Live ticket price (≈95% of 0.01 SOL):</p>
                      <p className="mt-1 font-mono text-sm text-accent-cyan">
                        {previewLoading
                          ? "Loading…"
                          : liquidPreviews[t.mint]
                            ? `~${liquidPreviews[t.mint].priceUi} per ticket`
                            : "—"}
                      </p>
                    </div>
                  )}
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    On-chain max cap
                    <input
                      type="number"
                      min={1}
                      value={s.onChainCap}
                      disabled={disabled}
                      onChange={(e) =>
                        patchSettings(t.mint, {
                          onChainCap: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    UI sell cap
                    <input
                      type="number"
                      min={0}
                      max={s.onChainCap}
                      value={s.displayCap}
                      disabled={disabled}
                      onChange={(e) =>
                        patchSettings(t.mint, {
                          displayCap: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                    />
                  </label>
                  <label className="flex items-center gap-2 self-end text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={s.published}
                      disabled={disabled}
                      onChange={(e) =>
                        patchSettings(t.mint, { published: e.target.checked })
                      }
                    />
                    Show in buy UI
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function validateProjectTokenDrawSettings(
  tokens: ProjectTokenForDraw[],
  enabled: Record<string, boolean>,
  settings: Record<string, ProjectTokenDrawSettings>,
): string | null {
  const active = tokens.filter((t) => enabled[t.mint]);
  if (active.length > SPL_MINT_MAX_ON_CHAIN) {
    return `At most ${SPL_MINT_MAX_ON_CHAIN} tokens per draw`;
  }
  for (const t of active) {
    const s = settings[t.mint];
    if (!s) return `Missing settings for ${t.projectName}`;
    if (s.onChainCap < 1) return `On-chain cap required for ${t.projectName}`;
    if (s.displayCap > s.onChainCap) {
      return `UI cap cannot exceed on-chain cap for ${t.projectName}`;
    }
    if (!t.liquid && (!s.priceUi || Number(s.priceUi) <= 0)) {
      return `Price required for ${t.projectName}`;
    }
  }
  return null;
}
