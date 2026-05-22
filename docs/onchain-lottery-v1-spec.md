# Slotto on-chain lottery — v1 product spec (devnet → mainnet)

Reference for implementing the Solana program (Anchor) + frontend integration. Decisions below are locked unless explicitly revised in this doc.

## Goals

- **Fully on-chain** ticket sales, **VRF-based** winner selection, **SOL-only** prize payout.
- **You own** program source, deploy keys, and upgrade policy (see §Upgrade).
- **SPL ticket path** for partner tokens; **SPL does not** increase the visible SOL jackpot; SPL inventory withdrawn OTC post-settlement (off-chain buybacks).

---

## Roles

- **Authority** (single pubkey): **`create_draw`** (with seed + SPL table + **start / end** timestamps), **`withdraw_spl`** after settle. Does **not** need to manually “click through” the draw if we use **permissionless** transition instructions (see §Draw lifecycle). **Oracle / priority fees** for VRF + settle are paid by **whoever submits** those txs (often you run a small **keeper** script so costs stay predictable).

---

## Draw schedule (countdown on home page)

At **`create_draw`**, store **two Unix timestamps** (source of truth for the Next.js countdown):

| Field | Meaning |
|-------|--------|
| **`sales_open_ts`** | Before this time, **`buy_*`** instructions **fail** (draw “not started” yet). |
| **`sales_close_ts`** | After this time, **`buy_*`** instructions **fail** (sales ended). Must be **`> sales_open_ts`**. |

The **home page countdown** should read these values from the **active draw account** (or an API that mirrors it) so marketing and chain stay aligned.

---

## SOL ticket economics (per ticket)

User pays **in one purchase**:

| Component | Amount (SOL) | Destination |
|-----------|--------------|-------------|
| Ticket (gross) | **0.01** | Split below |
| → Prize pot | **0.009** (90% of 0.01) | Draw **prize vault** |
| → Team / marketing | **0.0008** (8% of 0.01) | **Fixed** global `team_vault` |
| → BUX project | **0.0002** (2% of 0.01) | **Fixed** global `bux_vault` |
| Setup / recoup fee | **0.0005** (5% of 0.01, fixed per ticket) | **Fixed** global `setup_vault` |

**Total SOL per SOL ticket:** **0.0105**

**Bulk buys:** `buy_sol_tickets(count)` — user pays **`count * 0.0105` SOL**, receives **`count`** sequential **ticket IDs**.

SOL ticket sales are **uncapped** until **`sales_close_ts`** (and `buy_sol` rejected before **`sales_open_ts`**).

---

## SPL ticket economics

- **One ticket = one entry** (same win probability as SOL ticket).
- **Per draw**, at **`create_draw`**, authority supplies:
  - Allowlisted **mint** list  
  - **Per-mint SPL price** (human price → on-chain **base units** + decimals)  
  - **Per-mint max ticket count** (caps only — **no** separate global SPL cap; total SPL tickets for the draw = **sum of per-mint caps**)
- **Total SPL allocation is per-draw** (e.g. 600 one draw, higher next draw if you configure it that way).
- **SPL does not** add to the SOL **prize pot**; SPL accumulates in **program-controlled token accounts** for later **`withdraw_spl`** (authority-only, after **settled**).
- **Fee per SPL ticket:** **fixed 0.0005 SOL** (lamports), **always paid in SOL**, per ticket → **setup vault only** (no team/marketing payment on SPL buys; unlike SOL tickets).
- **Bulk buys:** `buy_spl_tickets(mint, count)` — **`count`** SPL amounts + **`count * 0.0005` SOL** in fees; **`count`** sequential ticket IDs.

### SPL app layer (Postgres + admin)

**On-chain** per-mint **`cap`** is the hard ceiling (`sold` cannot exceed `cap`). The app adds **Postgres** rows per draw + mint (keyed by on-chain `draw_id` + mint) for ops controls.

| Field | Purpose |
|-------|---------|
| **`on_chain_cap`** | Max tickets the program will ever sell for this mint on this draw (e.g. **500**). Set at `create_draw` / `add_spl_mint`. |
| **`display_cap`** | Max tickets **sellable in the UI**; must be **`≤ on_chain_cap`**. Admin can **raise** during a live draw (Postgres only). |
| **`published`** | Like project **Published**: hidden from buy UI until ticked on. |
| **`purchases_locked`** | Ops kill-switch (rug / not supporting): hide from UI and block app-built buys even if published. |

**Buy UI** enforces: selling window, **published**, **not locked**, `sold < display_cap`, chain `sold < on_chain_cap`.

**Stale draws in UI:** If draw **#N** is settled/refunded, older draws still **Selling** on-chain (e.g. accidental week-long **#2** after **#3** settled) are **ignored** in the homepage — no new program id required.

---

### SPL product requirements (v2 — target **50** mints)

**Catalog (persist across draws)**

- Do **not** re-enter every mint on each `create_draw`.
- **Load** the token list from the **previous draw** (Postgres `LotterySplCatalogEntry` + per-draw rows).
- Admin can **remove** tokens, change **on-chain cap** / **display cap**, toggle **published**, **lock** purchases, before submitting `create_draw`.
- Optional link to **Project** `tokenMint` for metadata (symbol, logo).

**Two-level caps**

| Level | Example | Who changes |
|-------|---------|-------------|
| **On-chain cap** | 500 | `create_draw` / `add_spl_mint` / future `update_spl_cap` (authority) |
| **Display cap** | 60 at launch → 120 mid-draw | Admin UI only (Postgres); can start low and **increase** if a token sells out quickly |

On-chain cap should be set **higher than** expected UI allocation so ops headroom does not require a program tx for every bump (within reason).

**Live draw admin**

- **Current draw settings** page: per-mint **display_cap** (raise only, `≤ on_chain_cap`), **published**, **purchases_locked**.
- **`add_spl_mint_to_draw`** (on-chain, authority): new project onboarded weeks into a month-long draw — append mint + caps + price.
- Future (optional): **`update_spl_on_chain_cap`** if display needs to exceed what was reserved at add time.

**Scale: 16 → 50 mints**

- v1 program: **`SPL_MINT_MAX = 16`** inline on `Draw` (~49 bytes/row → account size + rent).
- v2 direction (pick one in implementation):
  1. **Raise inline limit to 50** if rent/stack tests pass on devnet, or
  2. **`DrawSplTable` extension PDA** (`["draw_spl", draw]`) holding up to 50 rows so `Draw` stays small.
- New **program id** only if we ship breaking account layout; otherwise upgrade existing program after audit.

**Pricing (later — not this sprint)**

- **TODO:** Dynamic SPL ticket price = **~0.095 SOL** equivalent in the paid mint (oracle / Jupiter quote at buy time).
- Until then: fixed **price_per_ticket** (base units) per mint at `create_draw` / `add_spl_mint`.

---

## Draw lifecycle

Solana **does not run cron jobs**. “Automatic” means: the program **enforces timestamps** and exposes **permissionless** instructions that **anyone** can call once conditions are met (you, a user, or a **keeper** bot you run). Wall-clock “everything happens at `sales_close_ts`” becomes **one or more transactions** submitted at/after that time; **VRF fulfillment** usually adds **a short delay** (seconds–minutes) before **`settle`** can complete.

1. **`create_draw`** (authority)  
   - Sets **`sales_open_ts`** and **`sales_close_ts`**.  
   - Deposits **seed SOL** in the **same transaction** into the draw’s **prize vault**.  
   - Writes SPL config (mints, prices, per-mint caps).  
2. **Selling tickets** while `sales_open_ts <= now < sales_close_ts` (and SPL per-mint caps not exhausted). **`buy_*` fails** outside that window.  
3. **`close_sales`** — **permissionless** after `now >= sales_close_ts` (and SPL caps / state ok). Transitions draw to **“sales closed”** so no more purchases.  
4. **`request_vrf`** — **permissionless** once draw is **sales closed**, tickets sold, and VRF not yet requested. **v1 program:** records stub marker (see §Randomness); **production:** Switchboard CPI + real VRF account pubkey in `draw.vrf_request`.  
5. **`settle`** — **permissionless** once VRF step is satisfied (**v1:** stub path using `hashv`; **production:** verified Switchboard output). Computes winning **ticket id**, **pays withdrawable prize vault SOL** to winner **in this instruction** (no separate claim).  
6. **`withdraw_spl`** — **authority-only**, after **settled**, per mint.

**Product intent:** one **marketing “draw end”** time = **`sales_close_ts`**. Engineering reality: **winner + SOL payout** lands in **`settle`**, shortly after close when VRF is ready.

### Edge case (`N == 0`)

Ops assumes **at least one ticket**, but the program must not strand SOL.

- After **`close_sales`**, if **`total_tickets == 0`**, the draw **does not** enter VRF/settle.
- **`refund_empty_draw`** (new instruction): **permissionless** once draw is **`sales_closed`** and **`total_tickets == 0`**. Transfers **all withdrawable** prize vault SOL (vault lamports **minus** the **rent-exempt minimum** for the vault account, so the PDA stays valid) to **`seed_refund`**. Draw transitions to a terminal **`refunded`** state. **No SPL** path in this branch (no SPL inventory if no tickets, or if SPL-only zero tickets treat same — caps mean SPL sold is 0).

If **`total_tickets >= 1`**, flow is **`request_vrf` → `settle`** as above.

---

## Program design (v1) — locked

Concrete layout for Anchor implementation. Revise only if a constraint (rent, account size, Switchboard account list) forces it.

### PDA seeds (string literals are examples; use one consistent scheme in code)

| Account | Seeds (conceptual) | Notes |
|--------|---------------------|--------|
| **Global config** | `["global_config"]` | Singleton: `next_draw_id`, team/setup/authority pubkeys, program bump refs as needed. |
| **Draw** | `["draw", draw_id_le_u64]` | `draw_id` assigned from **`next_draw_id`** at **`create_draw`** (monotonic). |
| **Prize vault (SOL)** | `["prize_vault", draw_key]` | PDA with **no data** (or minimal discriminator); holds **native SOL** for the pot. **All** jackpot lamports live here until **`settle`** or **`refund_empty_draw`**. |
| **Ticket chunk** | `["tickets", draw_key, chunk_idx_le_u32]` | See §Ticket storage. |
| **SPL treasury ATA** | Standard **ATA** (mint, **vault authority** PDA) | One token account per allowlisted mint; authority PDA e.g. `["spl_vault_auth", draw_key]` or reuse draw PDA as signer per Anchor pattern. |

### Global config account

- **`team_vault`**, **`bux_vault`**, **`setup_vault`** (pubkeys — SOL recipients for splits; `team_vault` also receives SPL at purchase).  
- **`authority`** (create_draw, withdraw_spl).  
- **`next_draw_id: u64`** (starts at **0** or **1**; pick one and document in IDL).  
- **v1:** **Immutable** after **`initialize`** (no `update_config`); changes require **program upgrade** unless we explicitly add an instruction later.

### Draw account (fixed max size)

- **Identity:** `draw_id`, `bump` (draw), `prize_vault_bump`.  
- **Schedule:** `sales_open_ts`, `sales_close_ts` (i64 Unix).  
- **State machine:** `Created` → `Selling` (optional: implicit with timestamps) → **`SalesClosed`** → **`VrfRequested`** → **`Settled`** **or** **`Refunded`** (empty draw). Use a compact enum in Rust.  
- **Counts:** `total_tickets: u32` (or u64 if you expect huge draws — must match ticket id width).  
- **VRF:** Store whatever Switchboard requires (request account pubkey, slot, etc.) per their template.  
- **Post-settle:** `winning_ticket_id`, `winner` (pubkey), optional commitment hash if needed by template.  
- **`seed_refund`** pubkey for **`refund_empty_draw`**.  
- **SPL table (inline):** **`SPL_MINT_MAX = 16`** rows per draw (constant). Each row: `mint`, `price_per_ticket` (u64 base units), `mint_decimals` (u8), `cap` (u32), `sold` (u32). **Reject `create_draw`** if caller supplies **> 16** mints. Raises rent bound; document for ops.

### Ticket storage (owners on-chain)

- **Ticket IDs:** **0 … N-1** inclusive (`u32` or `u64` — **same width** as `total_tickets` counter). First minted ticket is **0**.  
- **Chunked PDAs:** constant **`TICKETS_PER_CHUNK`** (e.g. **256**). Ticket `id` lives in chunk **`id / TICKETS_PER_CHUNK`**, index **`id % TICKETS_PER_CHUNK`**. Each chunk account stores **`[Pubkey; TICKETS_PER_CHUNK]`** (owner wallet per ticket id). **`buy_*`** uses **`init_if_needed`** on the chunk account when crossing a chunk boundary.  
- **Winner pick:** `random_u256 % total_tickets` (or 64-bit equivalent) → **`winning_ticket_id`**, load owner from chunk accounts in **`settle`**.

### SPL rent / bounds

- **16 mints ×** per-mint ATA + draw row: acceptable for v1.  
- If product needs **> 16** mints per draw later, add a **v2** account type (e.g. extension PDA) rather than growing draw unbounded in v1.

### SPL treasury ATAs

- **v1 implementation:** SPL mint rows are written on **`create_draw`**. Per-mint **treasury ATAs** (authority PDA `["spl_vault_auth", draw]`) are created on first need inside **`buy_spl_tickets`** via **`init_if_needed`**, so `create_draw` stays a single compact transaction.

### Instruction ↔ account summary

| Instruction | Who | Key accounts |
|-------------|-----|----------------|
| `initialize` | Deployer / one-shot | Global config PDA |
| `create_draw` | Authority | Global config, new draw PDA, prize vault PDA, **payer** funds seed → vault; SPL rows persisted on draw (treasury ATAs created lazily in `buy_spl_tickets` with `init_if_needed` for smaller `create_draw` txs). |
| `buy_sol_tickets` | Anyone | Draw, prize vault, ticket chunk PDAs, team/setup system accounts, buyer |
| `buy_spl_tickets` | Anyone | Draw, `mint`, buyer ATA, treasury ATA (`init_if_needed`, auth `spl_vault_auth`), **setup** SOL vault (fee only), token + ATA programs, clock; **remaining:** ticket chunk PDAs (sorted) |
| `close_sales` | Permissionless | Draw, clock sysvar |
| `request_vrf` | Permissionless | Draw only (**v1 devnet stub:** sets `vrf_request = VRF_STUB_MARKER`; **production:** Switchboard CPI + real VRF account pubkey). |
| `settle` | Permissionless | Draw, prize vault, clock, rent, system; **remaining:** `[ticket_chunk_pda, winner]` (**v1 devnet stub:** `hashv` randomness from draw + clock — **not** mainnet-safe; replace with Switchboard read + verify). |
| `refund_empty_draw` | Permissionless | Draw, prize vault, `seed_refund` (must match `draw.seed_refund`), system, rent — transfers **withdrawable** SOL (vault lamports **minus** rent-exempt minimum for the vault account). |
| `withdraw_spl` | Authority | Draw, settled SPL ATA, authority destination |

---

## Tickets & winner

- **Global sequential ticket IDs:** **`0 … N-1`** (see §Program design).  
- **Owner per ticket id:** stored in **ticket chunk** PDAs (see §Program design).  
- **One winner**, **one winning ticket**; **uniform** probability per ticket.  
- **Prize amount:** entire **SOL balance** of the **prize vault** for that draw at settlement (seed + cumulative **0.009** per SOL ticket). **Do not** include team/setup buckets or SPL.

---

## Randomness

- **Target (mainnet):** **Switchboard On-Demand** verifiable randomness (commit → oracle generate → reveal). Use the **`switchboard-on-demand`** Rust crate (see [SDK version matrix](https://docs.switchboard.xyz/tooling/sdk-version-matrix.md)) aligned with this repo’s **Anchor / Solana** versions. Tutorial: [Randomness tutorial](https://docs.switchboard.xyz/docs-by-chain/solana-svm/randomness/randomness-tutorial) (`RandomnessAccountData`, slot window / freshness checks).
- **Program wiring (next implementation steps):**
  1. Create / commit a **randomness account** for the cluster’s Switchboard **queue** (devnet queue pubkey from Switchboard at deploy time).
  2. Store that account’s pubkey in **`draw.vrf_request`** (replacing the stub **`VRF_STUB_MARKER`** flow).
  3. **`settle`:** deserialize `RandomnessAccountData`, verify slot / freshness per Switchboard rules, read the **32-byte** value, then derive **`winning_ticket_id`** (handle modulo bias for large `N` if your auditor requires it).
  4. Until audited, ship **stub** path on devnet only (`stub_settle_winning_ticket_id` in `programs/slotto_lottery/src/lib.rs`).
- **Current program (v1 devnet / integration):** **`request_vrf`** sets `draw.vrf_request` to **`VRF_STUB_MARKER`**. **`settle`** uses **`stub_settle_winning_ticket_id`** (`hashv` over draw + clock) — exercises lifecycle on devnet; **not** mainnet-safe.

---

## Global config (fixed across draws)

- **Team / marketing** recipient pubkey  
- **Setup / recoup** recipient pubkey  
- **Authority** pubkey  

**v1:** Immutable after **`initialize`** (see §Program design); changing recipients requires **program upgrade** (or a future `update_config` if added).

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

- [x] Anchor program layout (see §Program design): global config PDA, draw PDA, prize vault (SOL), chunked ticket PDAs, SPL inline table max 16.  
- [x] **`create_draw`** (program): draw + prize vault PDAs, timestamps, seed transfer, SPL table.  
- [x] **`buy_sol_tickets`** (program): sales window, 0.0105 SOL splits, chunked ticket PDAs (`remaining_accounts` = chunk PDAs sorted by chunk index).  
- [x] **`buy_spl_tickets`** (program): allowlisted mint, cap, treasury ATA `init_if_needed`, SPL transfer, **0.0005 SOL × count** fee → setup vault only, shared ticket chunks.  
- [x] **`close_sales`** + **`refund_empty_draw`** (program): time-gated close; empty-draw refund (prize vault **above rent-exempt** minimum → `seed_refund`).  
- [x] **`request_vrf`** + **`settle`** (program, **stub VRF** — see §Randomness; Switchboard CPI still TODO).  
- [ ] **Switchboard** devnet + mainnet queue / feed addresses.  
- [x] **Recipient** pubkeys at `initialize`.  
- [x] **Rent** / account size: **50 SPL mints** max per draw (inline rows) + chunked tickets — see §Program design.  
- [ ] Tests: **done (lib):** `npm run lottery:test` (23 tests). **done (integration):** `npm run lottery:test:integration` — initialize, create_draw, empty refund, SOL buy→settle stub (`tests/slotto_lottery.ts`). **TODO:** SPL buy + cap exhaustion on-chain.  
- [x] **Keeper:** `npm run lottery:keeper` (local poll), `GET /api/lottery/crank` (Vercel cron every 2m, `CRON_SECRET`), homepage **server action** crank when **SalesClosed** / **VrfRequested** (instant, no secret in browser).
- [x] **App:** Admin SPL table on **create_draw** (load catalog, edit caps/published/lock); Postgres models; homepage **`buy_spl_tickets`** wired.
- [x] **App:** **Current draw** SPL settings (raise `display_cap`, published, purchases_locked).
- [x] **Program v2 (source):** **50** SPL rows + **`add_spl_mint_to_draw`** — **redeploy** devnet program to activate on-chain.
- [ ] **Later:** Dynamic SPL price ≈ **0.095 SOL** equivalent per mint at buy time.

---

## Revision log

| Date | Note |
|------|------|
| 2026-05-15 | Initial spec from product Q&A. SPL allocation confirmed **per-draw** at `create_draw` (sum of per-mint caps; not a fixed 600 globally). |
| 2026-05-15 | **Sales open / close** timestamps for UI countdown; **permissionless** `close_sales` / VRF / `settle` pipeline; note on Solana “automatic” vs wall clock + optional keeper. |
| 2026-05-15 | **§Program design (v1) locked:** PDAs, chunked tickets, prize vault, SPL ≤16, **`refund_empty_draw`**, immutable global config. |
| 2026-05-15 | Anchor workspace + **`initialize`** + **`create_draw`** (schedule, seed SOL, SPL rows); SPL treasury ATAs **lazy** in `buy_spl_tickets` (`init_if_needed`). |
| 2026-05-15 | **`request_vrf`** + **`settle`** (stub: `VRF_STUB_MARKER` + `hashv`; prize payout; remaining `[chunk, winner]`). |
| 2026-05-16 | **§Randomness:** On-Demand Switchboard checklist + links; stub roll extracted to `stub_settle_winning_ticket_id` + unit tests. |
| 2026-05-16 | Lib tests: `spl_apply_buy_to_row`, `spl_token_amount_for_buy`, `ticket_chunk_index` / `ticket_slot_in_chunk`, `find_spl_row_index_in_table`. |
| 2026-05-16 | `scripts/lottery-test-lib.sh` + `npm run lottery:test`; `sol_ticket_lamports_splits`; program `check-cfg` for Anchor macro warnings. |
| 2026-05-16 | Anchor integration tests: `tests/slotto_lottery.ts`, `npm run lottery:test:integration` (`anchor test` + local validator). |
| 2026-05-16 | `Cargo.lock`: pin `unicode-segmentation` 1.12.0 for Solana SBF rustc 1.84 (`anchor build` / `anchor test`). |
| 2026-05-16 | BPF stack: `Draw` + `TicketChunk` `zero_copy`; ticket owners via byte offsets (no `AccountLoader` on remaining accounts). |
| 2026-05-16 | Build: `bash scripts/anchor-build.sh` = `anchor build --no-idl` + `anchor idl build` on host Rust **1.84** (Anchor 0.30 IDL breaks on 1.85). |
| 2026-05-17 | **SPL app layer:** Postgres `display_cap` + `published` (project-style toggle); v1 = all mints at `create_draw`; **deferred** = add mint to live draw on-chain. |
| 2026-05-19 | **SPL v2 product:** catalog across draws, 50 mint target, two-level caps, live admin, `purchases_locked`, add-mint mid-draw; dynamic 0.095 SOL pricing **TODO**; UI ignores stale in-progress draws superseded by a later terminal draw. |
