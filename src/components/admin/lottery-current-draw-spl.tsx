"use client";

import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  adminAppendDrawSplMintDbAction,
  adminFetchDrawSplRowsAction,
  adminUpdateDrawSplMintAction,
} from "@/app/admin/(dashboard)/lotteries/actions";
import { DrawState } from "@/lib/lottery/constants";
import { lotteryProgramId } from "@/lib/lottery/config";
import { fetchInProgressDraw } from "@/lib/lottery/draws";
import { addSplMintToDraw } from "@/lib/lottery/add-spl-mint-to-draw";
import type { SplMintDraft } from "@/lib/lottery/spl-types";
import {
  LotterySplMintEditor,
  validateSplMintRows,
} from "@/components/admin/lottery-spl-mint-editor";

type DbRow = Awaited<ReturnType<typeof adminFetchDrawSplRowsAction>>[number];

export function LotteryCurrentDrawSpl() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const programId = useMemo(() => lotteryProgramId(), []);

  const [drawId, setDrawId] = useState<number | null>(null);
  const [drawPk, setDrawPk] = useState<string | null>(null);
  const [drawState, setDrawState] = useState<number | null>(null);
  const [rows, setRows] = useState<DbRow[]>([]);
  const [newMint, setNewMint] = useState<SplMintDraft[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const draw = await fetchInProgressDraw(connection, programId);
    if (!draw) {
      setDrawId(null);
      setRows([]);
      return;
    }
    setDrawId(draw.drawId);
    setDrawPk(draw.draw.toBase58());
    setDrawState(draw.state);
    const db = await adminFetchDrawSplRowsAction(draw.drawId);
    setRows(db);
  }, [connection, programId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selling = drawState === DrawState.Selling;

  const updateField = async (
    mint: string,
    data: {
      displayCap?: number;
      published?: boolean;
      purchasesLocked?: boolean;
    },
  ) => {
    if (drawId === null) return;
    setBusy(true);
    setMsg(null);
    try {
      await adminUpdateDrawSplMintAction(drawId, mint, data);
      await refresh();
      setMsg("Saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const onAddMintOnChain = async () => {
    if (drawId === null || !drawPk || !wallet || newMint.length === 0) return;
    const draft = newMint[0];
    const err = validateSplMintRows([draft]);
    if (err) {
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
      setMsg(`Mint added. ${sig.slice(0, 8)}…`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Add mint failed");
    } finally {
      setBusy(false);
    }
  };

  if (drawId === null) {
    return (
      <p className="text-sm text-muted">
        No in-progress draw. Create a draw or wait for an active selling round.
      </p>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-bg-elevated/70 p-6">
      <h2 className="text-lg font-semibold">
        Current draw #{drawId} — SPL settings
      </h2>
      {!selling ? (
        <p className="text-sm text-amber-100">
          Draw is not in Selling state; you can still toggle published/lock in
          DB, but on-chain add-mint is disabled.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No SPL rows in Postgres for this draw.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr className="border-b border-border">
                <th className="py-2 pr-3">Mint</th>
                <th className="py-2 pr-3">On-chain cap</th>
                <th className="py-2 pr-3">UI cap</th>
                <th className="py-2 pr-3">Published</th>
                <th className="py-2 pr-3">Locked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.mint} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-mono text-xs">
                    {r.symbol || r.mint.slice(0, 8)}…
                  </td>
                  <td className="py-2 pr-3">{r.onChainCap}</td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min={r.displayCap}
                      max={r.onChainCap}
                      defaultValue={r.displayCap}
                      disabled={busy}
                      className="w-20 rounded border border-border bg-surface px-2 py-1 text-sm"
                      onBlur={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (Number.isFinite(v) && v !== r.displayCap) {
                          void updateField(r.mint, { displayCap: v });
                        }
                      }}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      defaultChecked={r.published}
                      disabled={busy}
                      onChange={(e) =>
                        void updateField(r.mint, { published: e.target.checked })
                      }
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      defaultChecked={r.purchasesLocked}
                      disabled={busy}
                      onChange={(e) =>
                        void updateField(r.mint, {
                          purchasesLocked: e.target.checked,
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selling ? (
        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Add token to live draw</h3>
          <LotterySplMintEditor
            rows={newMint}
            onChange={setNewMint}
            disabled={busy}
            autoLoadCatalog={false}
          />
          <button
            type="button"
            disabled={busy || newMint.length === 0}
            onClick={onAddMintOnChain}
            className="mt-3 rounded-xl border border-accent-gold/50 px-4 py-2 text-sm font-semibold text-accent-gold disabled:opacity-50"
          >
            Add on-chain + save
          </button>
        </div>
      ) : null}

      {msg ? <p className="text-sm text-muted">{msg}</p> : null}
    </div>
  );
}
