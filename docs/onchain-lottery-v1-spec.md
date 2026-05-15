# Slotto on-chain lottery — v1 product spec (devnet → mainnet)

Reference for implementing the Solana program (Anchor) + frontend integration. Decisions below are locked unless explicitly revised in this doc.

## Goals

- **Fully on-chain** ticket sales, **VRF-based** winner selection, **SOL-only** prize payout.
- **You own** program source, deploy keys, and upgrade policy (see §Upgrade).
- **SPL ticket path** for partner tokens; **SPL does not** increase the visible SOL jackpot; SPL inventory withdrawn OTC post-settlement (off-chain buybacks).

---

## Roles

- **Authority** (single pubkey): create draws, configure per-draw SPL table, fund seed in `create_draw`, run `close_sales` if required by design, request VRF, run settle + auto-payout, withdraw SPL after settle. Pays oracle / priority fees for VRF + settlement flow (v1).

---

## SOL ticket economics (per ticket)

User pays **in one purchase**:

| Component | Amount (SOL) | Destination |
|-----------|--------------|-------------|
| Ticket (gross) | **0.01** | Split below |
| → Prize pot | **0.009** (90% of 0.01) | Draw **prize vault** |
| → Team / marketing | **0.001** (10% of 0.01) | **Fixed** global recipient |
| Setup / recoup fee | **0.0005** (5% of 0.01, fixed per ticket) | **Fixed** global recipient |

**Total SOL per SOL ticket:** **0.0105**

**Bulk buys:** `buy_sol_tickets(count)` — user pays **`count * 0.0105` SOL**, receives **`count`** sequential **ticket IDs**.

SOL ticket sales are **uncapped** until sales close (time-based, see §Draw lifecycle).

---

## SPL ticket economics

- **One ticket = one entry** (same win probability as SOL ticket).
- **Per draw**, at **`create_draw`**, authority supplies:
  - Allowlisted **mint** list  
  - **Per-mint SPL price** (human price → on-chain **base units** + decimals)  
  - **Per-mint max ticket count** (caps only — **no** separate global SPL cap; total SPL tickets for the draw = **sum of per-mint caps**)
- **Total SPL allocation is per-draw** (e.g. 600 one draw, higher next draw if you configure it that way).
- **SPL does not** add to the SOL **prize pot**; SPL accumulates in **program-controlled token accounts** for later **`withdraw_spl`** (authority-only, after **settled**).
- **Fee per SPL ticket:** **fixed 0.0005 SOL** (same as SOL path), **always paid in SOL**, per ticket.
- **Bulk buys:** `buy_spl_tickets(mint, count)` — **`count`** SPL amounts + **`count * 0.0005` SOL** in fees; **`count`** sequential ticket IDs.

---

## Draw lifecycle

1. **`create_draw`** (authority)  
   - Sets **close timestamp** (Unix).  
   - Deposits **seed SOL** (e.g. ~5 SOL) **in the same transaction** into the draw’s **prize vault**.  
   - Writes SPL config (mints, prices, per-mint caps).  
2. **Open sales** until `now >= close_time` **or** SPL mint exhausted on a mint (per-mint cap).  
3. **`close_sales`** after `close_time` (v1: **time-based** — callable after timestamp; confirm whether **anyone** or **authority-only** in implementation).  
4. **`request_vrf`** / consume Switchboard (authority pays fees in v1).  
5. **`settle`** — derive winning **ticket id**, **transfer 100% of prize vault SOL** to winner **in this flow** (no claim).  
6. **`withdraw_spl`** — authority pulls SPL balances for OTC (post-settle).

### Edge case

- **Require `total_tickets >= 1`** before VRF/settle **or** provide **`refund_seed`** if `N == 0`** so SOL cannot lock forever (defensive; ops assumes N ≥ 1).

---

## Tickets & winner

- **Global sequential ticket IDs** (`0 … N-1` or `1 … N` — pick one convention in code and keep consistent).  
- **`owner` per ticket id** stored on-chain (exact account layout TBD in program design).  
- **One winner**, **one winning ticket**; **uniform** probability per ticket.  
- **Prize amount:** entire **SOL balance** of the **prize vault** for that draw at settlement (seed + cumulative **0.009** per SOL ticket). **Do not** include team/setup buckets or SPL.

---

## Randomness

- **Switchboard VRF** (or equivalent verifiable randomness) on **mainnet**; devnet uses same integration against **devnet** queue/feed IDs.

---

## Global config (fixed across draws)

- **Team / marketing** recipient pubkey  
- **Setup / recoup** recipient pubkey  
- **Authority** pubkey  

Changing these later: **program upgrade** or dedicated **`update_config`** instruction if you add it (user preference was **fixed** addresses — clarify in code whether immutable after init or authority-updatable without upgrade).

---

## Upgrade policy

- **Recommended v1:** **upgradeable** program with upgrade authority on a **cold key / multisig**; document policy for users.  
- **Future:** consider **freezing** upgrade after audit + stable operation.

---

## Explicit non-goals / off-chain

- **No on-chain pause** (sales only stop at time + caps).  
- **SPL → SOL conversion** via founder buybacks is **off-chain**; program only custodies SPL until **`withdraw_spl`**.

---

## Frontend / indexer (v2 app)

- Next.js app: build txs, show draw state, decode accounts, link Solscan.  
- Postgres (optional): cache draw metadata for UI; **on-chain** is source of truth for balances and ticket ids.

---

## Open implementation checklist

- [ ] Anchor program layout: global config PDA, draw PDA, prize vault (SOL), ticket ownership accounts/Mapping.  
- [ ] **Switchboard** devnet + mainnet queue / feed addresses.  
- [ ] **`close_sales`**: permissionless vs authority-only.  
- [ ] **Recipient** pubkeys at `initialize`.  
- [ ] **Rent** and account size bounds for max SPL mints per draw.  
- [ ] Tests: splits, bulk buy math, SPL cap exhaustion, settlement + payout, `N=0` guard.

---

## Revision log

| Date | Note |
|------|------|
| 2026-05-15 | Initial spec from product Q&A. SPL allocation confirmed **per-draw** at `create_draw` (sum of per-mint caps; not a fixed 600 globally). |
