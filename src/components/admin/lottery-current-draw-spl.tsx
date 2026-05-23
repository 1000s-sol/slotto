"use client";

import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  adminAppendDrawSplMintDbAction,
  adminBatchUpdateDrawSplSettingsAction,
  adminFetchDrawSplRowsAction,
  adminSaveSplRowsForDrawAction,
} from "@/app/admin/(dashboard)/lotteries/actions";
import { DrawState } from "@/lib/lottery/constants";
import type { SplMintRowView } from "@/lib/lottery/chain";
import { lotteryProgramId } from "@/lib/lottery/config";
import { fetchInProgressDraw } from "@/lib/lottery/draws";
import { addSplMintToDraw } from "@/lib/lottery/add-spl-mint-to-draw";
import type { SplMintDraft } from "@/lib/lottery/spl-types";
import {
  LotterySplMintEditor,
  validateSplMintRows,
} from "@/components/admin/lottery-spl-mint-editor";

type DbRow = Awaited<ReturnType<typeof adminFetchDrawSplRowsAction>>[number];

type MintEdit = {
  displayCap: number;
  published: boolean;
  purchasesLocked: boolean;
};

function editsFromRows(rows: DbRow[]): Record<string, MintEdit> {
  const out: Record<string, MintEdit> = {};
  for (const r of rows) {
    out[r.mint] = {
      displayCap: r.displayCap,
      published: r.published,
      purchasesLocked: r.purchasesLocked,
    };
  }
  return out;
}

function chainRowsToDrafts(
  chainMints: SplMintRowView[],
  catalogRows: DbRow[],
): SplMintDraft[] {
  const byMint = new Map(catalogRows.map((r) => [r.mint, r]));
  return chainMints.map((m) => {
    const db = byMint.get(m.mint);
    return {
      mint: m.mint,
      symbol: db?.symbol ?? m.mint.slice(0, 4),
      label: db?.symbol ?? m.mint.slice(0, 8),
      mintDecimals: m.decimals,
      priceUi: "",
      pricePerTicket: m.pricePerTicket,
      onChainCap: m.cap,
      displayCap: db?.displayCap ?? m.cap,
      published: db?.published ?? false,
      purchasesLocked: db?.purchasesLocked ?? false,
    };
  });
}

export function LotteryCurrentDrawSpl() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const programId = useMemo(() => lotteryProgramId(), []);

  const [drawId, setDrawId] = useState<number | null>(null);
  const [drawPk, setDrawPk] = useState<string | null>(null);
  const [drawState, setDrawState] = useState<number | null>(null);
  const [chainMints, setChainMints] = useState<SplMintRowView[]>([]);
  const [rows, setRows] = useState<DbRow[]>([]);
  const [edits, setEdits] = useState<Record<string, MintEdit>>({});
  const [newMint, setNewMint] = useState<SplMintDraft[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<"ok" | "error">("ok");
  const [busy, setBusy] = useState(false);

  const selling = drawState === DrawState.Selling;

  const hasEdits = useMemo(() => {
    return rows.some((r) => {
      const e = edits[r.mint];
      if (!e) return false;
      return (
        e.displayCap !== r.displayCap ||
        e.published !== r.published ||
        e.purchasesLocked !== r.purchasesLocked
      );
    });
  }, [edits, rows]);

  const refresh = useCallback(async () => {
    const draw = await fetchInProgressDraw(connection, programId);
    if (!draw) {
      setDrawId(null);
      setDrawPk(null);
      setDrawState(null);
      setChainMints([]);
      setRows([]);
      setEdits({});
      return;
    }
    setDrawId(draw.drawId);
    setDrawPk(draw.draw.toBase58());
    setDrawState(draw.state);
    setChainMints(draw.splMints);

    let db = await adminFetchDrawSplRowsAction(draw.drawId);

    if (db.length === 0 && draw.splMints.length > 0) {
      const drafts = chainRowsToDrafts(draw.splMints, []);
      await adminSaveSplRowsForDrawAction(draw.drawId, drafts);
      db = await adminFetchDrawSplRowsAction(draw.drawId);
    }

    setRows(db);
    setEdits(editsFromRows(db));
  }, [connection, programId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setEdit = (mint: string, patch: Partial<MintEdit>) => {
    setEdits((prev) => {
      const cur = prev[mint];
      if (!cur) return prev;
      return { ...prev, [mint]: { ...cur, ...patch } };
    });
  };

  const onSaveAll = async () => {
    if (drawId === null || !hasEdits) return;
    setBusy(true);
    setMsg(null);
    try {
      const patches = rows
        .map((r) => {
          const e = edits[r.mint];
          if (!e) return null;
          const patch: {
            mint: string;
            displayCap?: number;
            published?: boolean;
            purchasesLocked?: boolean;
          } = { mint: r.mint };
          if (e.displayCap !== r.displayCap) patch.displayCap = e.displayCap;
          if (e.published !== r.published) patch.published = e.published;
          if (e.purchasesLocked !== r.purchasesLocked) {
            patch.purchasesLocked = e.purchasesLocked;
          }
          if (
            patch.displayCap === undefined &&
            patch.published === undefined &&
            patch.purchasesLocked === undefined
          ) {
            return null;
          }
          return patch;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      await adminBatchUpdateDrawSplSettingsAction(drawId, patches);
      await refresh();
      setMsgTone("ok");
      setMsg("Saved SPL settings for this draw.");
    } catch (e) {
      setMsgTone("error");
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const onAddMintOnChain = async () => {
    if (drawId === null || !drawPk || !wallet || newMint.length === 0) return;
    const draft = newMint[0];
    const err = validateSplMintRows([draft]);
    if (err) {
      setMsgTone("error");
      setMsg(err);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const sig = await addSplMintToDraw(
        connection,
        wallet,
        programId,
        new PublicKey(drawPk),
        draft,
      );
      await adminAppendDrawSplMintDbAction(drawId, draft);
      setNewMint([]);
      await refresh();
      setMsgTone("ok");
      setMsg(`Mint added. ${sig.slice(0, 8)}…`);
    } catch (e) {
      setMsgTone("error");
      setMsg(e instanceof Error ? e.message : "Add mint failed");
    } finally {
      setBusy(false);
    }
  };

  const soldByMint = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of chainMints) m.set(c.mint, c.sold);
    return m;
  }, [chainMints]);

  if (drawId === null) {
    return (
      <p className="text-sm text-muted">
        No in-progress draw. Create a draw or wait for an active selling round.
      </p>
    );
  }

  return (
    <div
      id="current-draw-spl"
      className="space-y-4 rounded-2xl border border-border bg-bg-elevated/70 p-6"
    >
      <h2 className="text-lg font-semibold">
        Current draw #{drawId} — SPL settings
      </h2>
      {!selling ? (
        <p className="text-sm text-amber-100">
          Draw is not in Selling state; you can still update published/lock and UI
          caps in the database, but on-chain add-mint is disabled.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          No SPL rows for this draw yet. Add a token below or create the draw with SPL
          mints configured.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted">
            Edit UI caps and flags below, then click Save changes. UI cap can only be
            raised (not lowered below the saved value). On-chain add-mint is optional.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3">Mint</th>
                  <th className="py-2 pr-3">Sold</th>
                  <th className="py-2 pr-3">On-chain cap</th>
                  <th className="py-2 pr-3">UI cap</th>
                  <th className="py-2 pr-3">Published</th>
                  <th className="py-2 pr-3">Locked</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const e = edits[r.mint];
                  if (!e) return null;
                  const sold = soldByMint.get(r.mint) ?? 0;
                  return (
                    <tr key={r.mint} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {r.symbol || r.mint.slice(0, 8)}…
                      </td>
                      <td className="py-2 pr-3 text-muted">
                        {sold}/{r.onChainCap}
                      </td>
                      <td className="py-2 pr-3">{r.onChainCap}</td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min={r.displayCap}
                          max={r.onChainCap}
                          value={e.displayCap}
                          disabled={busy}
                          className="w-20 rounded border border-border bg-surface px-2 py-1 text-sm"
                          onChange={(ev) => {
                            const v = parseInt(ev.target.value, 10);
                            if (Number.isFinite(v)) {
                              setEdit(r.mint, {
                                displayCap: Math.min(
                                  r.onChainCap,
                                  Math.max(r.displayCap, v),
                                ),
                              });
                            }
                          }}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={e.published}
                          disabled={busy}
                          onChange={(ev) =>
                            setEdit(r.mint, { published: ev.target.checked })
                          }
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={e.purchasesLocked}
                          disabled={busy}
                          onChange={(ev) =>
                            setEdit(r.mint, {
                              purchasesLocked: ev.target.checked,
                            })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !hasEdits}
              onClick={() => void onSaveAll()}
              className="rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save changes
            </button>
            {hasEdits ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setEdits(editsFromRows(rows))}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted hover:text-foreground disabled:opacity-50"
              >
                Discard edits
              </button>
            ) : null}
          </div>
        </>
      )}

      {selling ? (
        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Add token to live draw (optional)</h3>
          <p className="mt-1 text-xs text-muted">
            Only needed when onboarding a new project mid-draw. Saving existing rows does
            not require adding a token.
          </p>
          <LotterySplMintEditor
            rows={newMint}
            onChange={setNewMint}
            disabled={busy}
            autoLoadCatalog={false}
          />
          <button
            type="button"
            disabled={busy || newMint.length === 0}
            onClick={() => void onAddMintOnChain()}
            className="mt-3 rounded-xl border border-accent-gold/50 px-4 py-2 text-sm font-semibold text-accent-gold disabled:opacity-50"
          >
            Add on-chain + save
          </button>
        </div>
      ) : null}

      {msg ? (
        <p
          className={`text-sm ${msgTone === "error" ? "text-red-300" : "text-emerald-200"}`}
        >
          {msg}
        </p>
      ) : null}
    </div>
  );
}
