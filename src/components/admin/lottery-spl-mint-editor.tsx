"use client";

import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";

import { adminLoadSplCatalogAction } from "@/app/admin/(dashboard)/lotteries/actions";
import { splUiAmountToBaseUnits } from "@/lib/lottery/spl-price";
import type { SplMintDraft } from "@/lib/lottery/spl-types";
import { SPL_MINT_MAX_ON_CHAIN } from "@/lib/lottery/spl-types";

function emptyRow(): SplMintDraft {
  return {
    mint: "",
    symbol: "",
    label: "",
    mintDecimals: 9,
    priceUi: "1",
    pricePerTicket: "1000000000",
    onChainCap: 500,
    displayCap: 60,
    published: false,
    purchasesLocked: false,
  };
}

export type LotterySplMintEditorProps = {
  rows: SplMintDraft[];
  onChange: (rows: SplMintDraft[]) => void;
  disabled?: boolean;
};

export function LotterySplMintEditor({
  rows,
  onChange,
  disabled,
}: LotterySplMintEditorProps) {
  const [loading, setLoading] = useState(false);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const catalog = await adminLoadSplCatalogAction();
      onChange(catalog.length > 0 ? catalog : []);
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  useEffect(() => {
    if (rows.length === 0) {
      void loadCatalog();
    }
  }, [loadCatalog, rows.length]);

  const updateRow = (index: number, patch: Partial<SplMintDraft>) => {
    const next = rows.map((r, i) => {
      if (i !== index) return r;
      const merged = { ...r, ...patch };
      if (patch.priceUi !== undefined || patch.mintDecimals !== undefined) {
        try {
          merged.pricePerTicket = splUiAmountToBaseUnits(
            merged.priceUi || "0",
            merged.mintDecimals,
          ).toString();
        } catch {
          /* keep prior */
        }
      }
      if (patch.displayCap !== undefined || patch.onChainCap !== undefined) {
        merged.displayCap = Math.min(merged.displayCap, merged.onChainCap);
      }
      return merged;
    });
    onChange(next);
  };

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const addRow = () => {
    if (rows.length >= SPL_MINT_MAX_ON_CHAIN) return;
    onChange([...rows, emptyRow()]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          SPL ticket tokens ({rows.length}/{SPL_MINT_MAX_ON_CHAIN} on-chain max)
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled || loading}
            onClick={() => loadCatalog()}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground disabled:opacity-50"
          >
            {loading ? "Loading…" : "Reload from last draw"}
          </button>
          <button
            type="button"
            disabled={disabled || rows.length >= SPL_MINT_MAX_ON_CHAIN}
            onClick={addRow}
            className="rounded-lg border border-accent-purple/50 px-3 py-1.5 text-xs font-medium text-accent-purple disabled:opacity-50"
          >
            Add token
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted">
          No SPL rows. Add tokens or reload from the previous draw catalog.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div
              key={`${row.mint || "new"}-${i}`}
              className="rounded-xl border border-border bg-surface/40 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">
                  Token #{i + 1}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeRow(i)}
                  className="text-xs text-red-400 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
                  Mint address
                  <input
                    value={row.mint}
                    disabled={disabled}
                    onChange={(e) => updateRow(i, { mint: e.target.value.trim() })}
                    className="rounded-lg border border-border bg-surface px-2 py-1.5 font-mono text-xs text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Symbol
                  <input
                    value={row.symbol}
                    disabled={disabled}
                    onChange={(e) => updateRow(i, { symbol: e.target.value })}
                    className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Decimals
                  <input
                    type="number"
                    min={0}
                    max={9}
                    value={row.mintDecimals}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRow(i, {
                        mintDecimals: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Price per ticket (human)
                  <input
                    value={row.priceUi}
                    disabled={disabled}
                    onChange={(e) => updateRow(i, { priceUi: e.target.value })}
                    className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  On-chain max cap
                  <input
                    type="number"
                    min={1}
                    value={row.onChainCap}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRow(i, {
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
                    max={row.onChainCap}
                    value={row.displayCap}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRow(i, {
                        displayCap: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-2 text-muted">
                  <input
                    type="checkbox"
                    checked={row.published}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRow(i, { published: e.target.checked })
                    }
                  />
                  Published (show in buy UI)
                </label>
                <label className="flex items-center gap-2 text-muted">
                  <input
                    type="checkbox"
                    checked={row.purchasesLocked}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRow(i, { purchasesLocked: e.target.checked })
                    }
                  />
                  Lock purchases
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function validateSplMintRows(rows: SplMintDraft[]): string | null {
  const seen = new Set<string>();
  const active = rows.filter((r) => r.mint.trim());
  for (const r of active) {
    try {
      new PublicKey(r.mint);
    } catch {
      return `Invalid mint: ${r.mint}`;
    }
    if (seen.has(r.mint)) return `Duplicate mint ${r.mint}`;
    seen.add(r.mint);
    if (r.onChainCap < 1) return "On-chain cap must be at least 1";
    if (r.displayCap > r.onChainCap) {
      return `UI cap cannot exceed on-chain cap for ${r.symbol || r.mint}`;
    }
    if (!r.pricePerTicket || r.pricePerTicket === "0") {
      return `Price required for ${r.symbol || r.mint}`;
    }
  }
  if (active.length > SPL_MINT_MAX_ON_CHAIN) {
    return `At most ${SPL_MINT_MAX_ON_CHAIN} SPL mints per draw`;
  }
  return null;
}
