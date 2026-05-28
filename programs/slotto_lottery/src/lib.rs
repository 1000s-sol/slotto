//! Slotto lottery program — Anchor v1.
//! Spec: `docs/onchain-lottery-v1-spec.md`. Run `anchor keys sync` so `declare_id!` matches deploy keys.

use anchor_lang::prelude::*;
use anchor_lang::Discriminator;
use anchor_lang::solana_program::hash::hashv;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::solana_program::sysvar::rent::Rent;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

mod switchboard_randomness;
use switchboard_randomness::{
    is_switchboard_randomness_owner, read_switchboard_randomness_value,
    winning_ticket_from_vrf_bytes,
};

declare_id!("6mYYxtJ4NPH1oNJoy2CpJGQq6XiWCsu8iB5y6ior6TMq");

/// Max SPL mints inlined on [`Draw`] (see spec).
pub const SPL_MINT_MAX: usize = 50;

/// Owners per [`TicketChunk`] PDA (see spec).
pub const TICKETS_PER_CHUNK: usize = 256;

/// Per SOL ticket: **0.009** SOL → prize vault (lamports).
pub const LAMPORTS_SOL_TICKET_POT: u64 = 9_000_000;
/// Per SOL ticket: **0.0008** SOL → team (8% of 0.01 ticket price, lamports).
pub const LAMPORTS_SOL_TICKET_TEAM: u64 = 800_000;
/// Per SOL ticket: **0.0002** SOL → BUX project wallet (2% of 0.01, lamports).
pub const LAMPORTS_SOL_TICKET_BUX: u64 = 200_000;
/// Per SOL ticket: **0.0005** SOL → setup (lamports).
pub const LAMPORTS_SOL_TICKET_SETUP: u64 = 500_000;
/// Per SOL ticket total charged: **0.0105** SOL (lamports).
pub const LAMPORTS_SOL_TICKET_TOTAL: u64 = 10_500_000;

/// Hard cap per tx so chunk `remaining_accounts` + compute stay bounded.
pub const MAX_SOL_TICKETS_PER_BUY: u32 = 256;

/// **Devnet / integration stub:** marks that `request_vrf` ran without a live Switchboard account yet.
/// `settle` only accepts this marker until Switchboard CPI + account layout is wired (see spec).
pub const VRF_STUB_MARKER: Pubkey = Pubkey::new_from_array([
    b'S', b'L', b'O', b'T', b'T', b'O', b'_', b'V', b'R', b'F', b'_', b'S', b'T', b'U', b'B', b'_',
    b'v', b'1', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]);

/// Devnet / integration: derive winning ticket index from draw key + clock (see §Randomness in spec).
/// **Replace** with Switchboard On-Demand `RandomnessAccountData::get_value` (or equivalent) for production.
pub(crate) fn stub_settle_winning_ticket_id(
    draw_key: &Pubkey,
    slot: u64,
    unix_ts: i64,
    total_tickets: u32,
) -> Result<u32> {
    require!(total_tickets >= 1, ErrorCode::VrfNeedsTickets);
    let h = hashv(&[
        b"slotto::settle_stub_v1",
        draw_key.as_ref(),
        &slot.to_le_bytes(),
        &unix_ts.to_le_bytes(),
    ]);
    let b = h.to_bytes();
    let roll = u64::from_le_bytes(b[0..8].try_into().unwrap());
    Ok((roll % total_tickets as u64) as u32)
}

/// Lamports that can leave the prize vault **without** closing it (`vault_lamports - rent_exempt_min`),
/// when underflow must surface as an error (e.g. **`refund_empty_draw`**).
pub(crate) fn prize_vault_withdrawable_checked(
    vault_lamports: u64,
    rent_exempt_min: u64,
) -> Result<u64> {
    vault_lamports
        .checked_sub(rent_exempt_min)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))
}

/// Same as [`prize_vault_withdrawable_checked`] but clamps at zero (used by **`settle`**).
#[inline]
/// Move lamports out of the prize-vault PDA (has account data; cannot use `system_transfer` as `from`).
pub(crate) fn transfer_prize_vault_lamports(
    vault: &AccountInfo<'_>,
    recipient: &AccountInfo<'_>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let vault_lamports = vault.lamports();
    require!(
        vault_lamports >= amount,
        ErrorCode::ArithmeticOverflow
    );
    **vault.try_borrow_mut_lamports()? = vault_lamports
        .checked_sub(amount)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    **recipient.try_borrow_mut_lamports()? = recipient
        .lamports()
        .checked_add(amount)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    Ok(())
}

pub(crate) fn prize_vault_withdrawable_saturating(vault_lamports: u64, rent_exempt_min: u64) -> u64 {
    vault_lamports.saturating_sub(rent_exempt_min)
}

/// Same cap for SPL buys (per tx).
pub const MAX_SPL_TICKETS_PER_BUY: u32 = 256;

/// Per SPL ticket: **0.0005** SOL total fee (lamports), paid like the non-pot slice of a SOL ticket.
pub const LAMPORTS_SPL_TICKET_FEE_TOTAL: u64 = 500_000;

#[program]
pub mod slotto_lottery {
    use super::*;

    /// One-time program config: team + BUX + setup SOL recipients, draw authority, `next_draw_id` counter.
    pub fn initialize(
        ctx: Context<Initialize>,
        team_vault: Pubkey,
        bux_vault: Pubkey,
        setup_vault: Pubkey,
    ) -> Result<()> {
        require_keys_neq!(team_vault, Pubkey::default());
        require_keys_neq!(bux_vault, Pubkey::default());
        require_keys_neq!(setup_vault, Pubkey::default());

        let cfg = &mut ctx.accounts.global_config;
        cfg.team_vault = team_vault;
        cfg.bux_vault = bux_vault;
        cfg.setup_vault = setup_vault;
        cfg.authority = ctx.accounts.authority.key();
        cfg.next_draw_id = 0;
        cfg.bump = ctx.bumps.global_config;
        Ok(())
    }

    /// Authority opens a new draw: schedule, optional seed SOL into prize vault, SPL mint table (rows only).
    ///
    /// SPL ticket proceeds go to the global **team** wallet ATA (`init_if_needed` in `buy_spl_tickets`).
    /// Legacy per-draw treasury PDAs remain for **`withdraw_spl`** on older draws only.
    pub fn create_draw(
        ctx: Context<CreateDraw>,
        sales_open_ts: i64,
        sales_close_ts: i64,
        seed_refund: Pubkey,
        seed_lamports: u64,
        spl_rows: Vec<SplMintArg>,
    ) -> Result<()> {
        require!(sales_close_ts > sales_open_ts, ErrorCode::InvalidSchedule);
        require!(spl_rows.len() <= SPL_MINT_MAX, ErrorCode::TooManySplMints);

        let refund = if seed_refund == Pubkey::default() {
            ctx.accounts.authority.key()
        } else {
            seed_refund
        };
        require_keys_neq!(refund, Pubkey::default());

        let draw_id = ctx.accounts.global_config.next_draw_id;

        let mut seen: Vec<Pubkey> = Vec::with_capacity(spl_rows.len());
        for row in &spl_rows {
            require_keys_neq!(row.mint, Pubkey::default());
            require!(row.cap > 0, ErrorCode::InvalidSplCap);
            require!(row.price_per_ticket > 0, ErrorCode::InvalidSplPrice);
            for m in &seen {
                require_keys_neq!(row.mint, *m);
            }
            seen.push(row.mint);
        }

        let (_, spl_auth_bump) =
            Pubkey::find_program_address(&[b"spl_vault_auth", ctx.accounts.draw.key().as_ref()], ctx.program_id);

        {
            let mut draw = ctx.accounts.draw.load_init()?;
            draw.draw_id = draw_id;
            draw.bump = ctx.bumps.draw;
            draw.prize_vault_bump = ctx.bumps.prize_vault;
            draw.sales_open_ts = sales_open_ts;
            draw.sales_close_ts = sales_close_ts;
            draw.state = DrawState::Selling as u8;
            draw.total_tickets = 0;
            draw.seed_refund = refund;
            draw.spl_count = spl_rows.len() as u8;
            for row in draw.spl_mint_rows.iter_mut() {
                *row = SplMintRow::default();
            }
            for (i, row) in spl_rows.iter().enumerate() {
                draw.spl_mint_rows[i] = SplMintRow {
                    mint: row.mint,
                    price_per_ticket: row.price_per_ticket,
                    mint_decimals: row.mint_decimals,
                    cap: row.cap,
                    sold: 0,
                };
            }
            draw.vrf_request = Pubkey::default();
            draw.winning_ticket_id = 0;
            draw.winner = Pubkey::default();
            draw.spl_auth_bump = spl_auth_bump;
        }

        if seed_lamports > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.authority.to_account_info(),
                        to: ctx.accounts.prize_vault.to_account_info(),
                    },
                ),
                seed_lamports,
            )?;
        }

        let _chunk = ctx.accounts.ticket_chunk_0.load_init()?;

        ctx.accounts.global_config.next_draw_id = draw_id
            .checked_add(1)
            .ok_or(error!(ErrorCode::DrawIdOverflow))?;

        Ok(())
    }

    /// Authority: append one SPL mint row while the draw is still **Selling** (`spl_count < SPL_MINT_MAX`).
    pub fn add_spl_mint_to_draw(ctx: Context<AddSplMintToDraw>, spl_row: SplMintArg) -> Result<()> {
        require_keys_neq!(spl_row.mint, Pubkey::default());
        require!(spl_row.cap > 0, ErrorCode::InvalidSplCap);
        require!(spl_row.price_per_ticket > 0, ErrorCode::InvalidSplPrice);

        let mut draw = ctx.accounts.draw.load_mut()?;
        require!(
            draw.state == DrawState::Selling as u8,
            ErrorCode::WrongDrawState
        );
        require!(
            (draw.spl_count as usize) < SPL_MINT_MAX,
            ErrorCode::TooManySplMints
        );

        for i in 0..draw.spl_count as usize {
            require_keys_neq!(
                draw.spl_mint_rows[i].mint,
                spl_row.mint,
                ErrorCode::SplMintAlreadyInDraw
            );
        }

        let idx = draw.spl_count as usize;
        draw.spl_mint_rows[idx] = SplMintRow {
            mint: spl_row.mint,
            price_per_ticket: spl_row.price_per_ticket,
            mint_decimals: spl_row.mint_decimals,
            cap: spl_row.cap,
            sold: 0,
        };
        draw.spl_count = draw
            .spl_count
            .checked_add(1)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
        Ok(())
    }

    /// Authority: fund ticket-chunk PDA rent before sales cross chunk boundaries (chunk 0 is created in `create_draw`).
    pub fn init_ticket_chunk(ctx: Context<InitTicketChunk>, chunk_index: u32) -> Result<()> {
        require!(chunk_index > 0, ErrorCode::InvalidTicketCount);
        let draw = ctx.accounts.draw.load()?;
        require!(draw.state == DrawState::Selling as u8, ErrorCode::WrongDrawState);
        let _chunk = ctx.accounts.ticket_chunk.load_init()?;
        Ok(())
    }

    /// Buy `count` SOL tickets while sales are open. **Remaining accounts:** one account per touched
    /// ticket-chunk PDA, **sorted ascending by chunk index** (see `ticket_chunk_indices_for_range`).
    pub fn buy_sol_tickets(ctx: Context<BuySolTickets>, count: u32) -> Result<()> {
        require!(count > 0 && count <= MAX_SOL_TICKETS_PER_BUY, ErrorCode::InvalidTicketCount);

        let draw_key = ctx.accounts.draw.key();
        let (base, draw_state, sales_open, sales_close) = {
            let draw = ctx.accounts.draw.load()?;
            (
                draw.total_tickets,
                draw.state,
                draw.sales_open_ts,
                draw.sales_close_ts,
            )
        };

        require!(draw_state == DrawState::Selling as u8, ErrorCode::WrongDrawState);

        let now = ctx.accounts.clock.unix_timestamp;
        require!(
            now >= sales_open && now < sales_close,
            ErrorCode::OutsideSalesWindow
        );

        let new_total = base
            .checked_add(count)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;

        let (pot, team, setup) = sol_ticket_lamports_splits(count)?;

        let chunk_indices = ticket_chunk_indices_for_range(base, count)?;
        require_eq!(
            ctx.remaining_accounts.len(),
            chunk_indices.len(),
            ErrorCode::InvalidChunkAccounts
        );

        let buyer_key = ctx.accounts.buyer.key();
        let program_id = ctx.program_id;

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.prize_vault.to_account_info(),
                },
            ),
            pot,
        )?;
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.team_vault.to_account_info(),
                },
            ),
            team,
        )?;
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.setup_vault.to_account_info(),
                },
            ),
            setup,
        )?;

        for (i, &chunk_idx) in chunk_indices.iter().enumerate() {
            let chunk_ai = &ctx.remaining_accounts[i];
            require_ticket_chunk_initialized(program_id, chunk_ai, &draw_key, chunk_idx)?;

            let chunk_start = chunk_idx
                .checked_mul(TICKETS_PER_CHUNK as u32)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
            let chunk_end = chunk_start
                .checked_add(TICKETS_PER_CHUNK as u32)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
            let from = base.max(chunk_start);
            let to = new_total.min(chunk_end);

            assign_ticket_range(&ctx.remaining_accounts[i], chunk_start, from, to, buyer_key)?;
        }

        let mut draw = ctx.accounts.draw.load_mut()?;
        draw.total_tickets = new_total;
        Ok(())
    }

    /// Buy `count` SPL tickets for `mint` (allowlisted on the draw). SPL → team wallet ATA at purchase;
    /// **0.0005 SOL × count** setup fee only (no SOL team/BUX slice on SPL buys).
    ///
    /// **Remaining accounts:** same as [`buy_sol_tickets`] — ticket chunk PDAs, sorted by chunk index.
    pub fn buy_spl_tickets(ctx: Context<BuySplTickets>, count: u32) -> Result<()> {
        require!(count > 0 && count <= MAX_SPL_TICKETS_PER_BUY, ErrorCode::InvalidTicketCount);

        let mint_key = ctx.accounts.mint.key();
        let draw_key = ctx.accounts.draw.key();
        let (row_ix, row, base, draw_state, sales_open, sales_close) = {
            let draw = ctx.accounts.draw.load()?;
            let row_ix =
                find_spl_row_index_in_table(&draw.spl_mint_rows, draw.spl_count, &mint_key)
                    .ok_or(ErrorCode::MintNotInDraw)?;
            (
                row_ix,
                draw.spl_mint_rows[row_ix],
                draw.total_tickets,
                draw.state,
                draw.sales_open_ts,
                draw.sales_close_ts,
            )
        };
        require_keys_neq!(row.mint, Pubkey::default());
        require!(ctx.accounts.mint.decimals == row.mint_decimals, ErrorCode::SplMintDecimalsMismatch);

        let new_sold = spl_apply_buy_to_row(row.sold, count, row.cap)?;

        require!(draw_state == DrawState::Selling as u8, ErrorCode::WrongDrawState);

        let now = ctx.accounts.clock.unix_timestamp;
        require!(
            now >= sales_open && now < sales_close,
            ErrorCode::OutsideSalesWindow
        );

        let new_total = base
            .checked_add(count)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;

        let spl_amount = spl_token_amount_for_buy(row.price_per_ticket, count)?;

        let fee_setup = spl_fee_lamports_total(count)?;

        let chunk_indices = ticket_chunk_indices_for_range(base, count)?;
        require_eq!(
            ctx.remaining_accounts.len(),
            chunk_indices.len(),
            ErrorCode::InvalidChunkAccounts
        );

        let buyer_key = ctx.accounts.buyer.key();
        let program_id = ctx.program_id;

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.setup_vault.to_account_info(),
                },
            ),
            fee_setup,
        )?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.buyer_token.to_account_info(),
                    to: ctx.accounts.team_token.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            spl_amount,
        )?;

        for (i, &chunk_idx) in chunk_indices.iter().enumerate() {
            let chunk_ai = &ctx.remaining_accounts[i];
            require_ticket_chunk_initialized(program_id, chunk_ai, &draw_key, chunk_idx)?;

            let chunk_start = chunk_idx
                .checked_mul(TICKETS_PER_CHUNK as u32)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
            let chunk_end = chunk_start
                .checked_add(TICKETS_PER_CHUNK as u32)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
            let from = base.max(chunk_start);
            let to = new_total.min(chunk_end);

            assign_ticket_range(chunk_ai, chunk_start, from, to, buyer_key)?;
        }

        let mut draw = ctx.accounts.draw.load_mut()?;
        draw.total_tickets = new_total;
        draw.spl_mint_rows[row_ix].sold = new_sold;
        Ok(())
    }

    /// Permissionless: once `now >= sales_close_ts`, move draw from **Selling** → **SalesClosed** (no more tickets).
    pub fn close_sales(ctx: Context<CloseSales>) -> Result<()> {
        let mut draw = ctx.accounts.draw.load_mut()?;
        require!(
            draw.state == DrawState::Selling as u8,
            ErrorCode::InvalidDrawStateForCloseSales
        );
        let now = ctx.accounts.clock.unix_timestamp;
        require!(now >= draw.sales_close_ts, ErrorCode::SalesPeriodNotEnded);
        draw.state = DrawState::SalesClosed as u8;
        Ok(())
    }

    /// Permissionless: after **SalesClosed**, if **`total_tickets == 0`**, send prize vault SOL (above rent-exempt
    /// minimum for the vault account) to **`seed_refund`**, then **Refunded**.
    pub fn refund_empty_draw(ctx: Context<RefundEmptyDraw>) -> Result<()> {
        let (draw_state, total_tickets, seed_refund_key) = {
            let draw = ctx.accounts.draw.load()?;
            (
                draw.state,
                draw.total_tickets,
                draw.seed_refund,
            )
        };
        require!(
            draw_state == DrawState::SalesClosed as u8,
            ErrorCode::InvalidDrawStateForRefund
        );
        require!(total_tickets == 0, ErrorCode::RefundDrawHasTickets);
        require_keys_eq!(
            ctx.accounts.seed_refund.key(),
            seed_refund_key,
            ErrorCode::InvalidSeedRefund
        );
        let vault_info = ctx.accounts.prize_vault.to_account_info();
        let min_balance = ctx
            .accounts
            .rent
            .minimum_balance(vault_info.data_len());
        let vault_lamports = vault_info.lamports();
        let available =
            prize_vault_withdrawable_checked(vault_lamports, min_balance)?;

        transfer_prize_vault_lamports(
            &vault_info,
            &ctx.accounts.seed_refund.to_account_info(),
            available,
        )?;

        let mut draw = ctx.accounts.draw.load_mut()?;
        draw.state = DrawState::Refunded as u8;
        Ok(())
    }

    /// Records VRF request. **Stub (devnet):** no remaining accounts → [`VRF_STUB_MARKER`].
    /// **Switchboard:** one remaining account — randomness account (commit must land same slot; see keeper).
    pub fn request_vrf(ctx: Context<RequestVrf>) -> Result<()> {
        let mut draw = ctx.accounts.draw.load_mut()?;
        require!(
            draw.state == DrawState::SalesClosed as u8,
            ErrorCode::InvalidDrawStateForVrf
        );
        require!(draw.total_tickets >= 1, ErrorCode::VrfNeedsTickets);
        require_keys_eq!(draw.vrf_request, Pubkey::default(), ErrorCode::VrfAlreadyRequested);

        if ctx.remaining_accounts.is_empty() {
            draw.vrf_request = VRF_STUB_MARKER;
        } else {
            require_eq!(
                ctx.remaining_accounts.len(),
                1,
                ErrorCode::RequestVrfAccountsWrongLen
            );
            let randomness = &ctx.remaining_accounts[0];
            require!(
                is_switchboard_randomness_owner(randomness.owner),
                ErrorCode::InvalidRandomnessAccount
            );
            draw.vrf_request = randomness.key();
        }

        draw.state = DrawState::VrfRequested as u8;
        Ok(())
    }

    /// Picks winner (stub: `hashv` over draw + clock), pays **withdrawable** prize vault SOL to winner.
    ///
    /// **Remaining accounts:** `[ticket_chunk_pda, winner_system_account]` — chunk must contain the winning ticket id.
    pub fn settle(ctx: Context<SettleDraw>) -> Result<()> {
        let draw_key = ctx.accounts.draw.key();
        let (state, vrf_request, n) = {
            let draw = ctx.accounts.draw.load()?;
            (
                draw.state,
                draw.vrf_request,
                draw.total_tickets,
            )
        };

        require!(
            state == DrawState::VrfRequested as u8,
            ErrorCode::InvalidDrawStateForSettle
        );
        require!(n >= 1, ErrorCode::VrfNeedsTickets);

        let slot = ctx.accounts.clock.slot;
        let ts = ctx.accounts.clock.unix_timestamp;

        let (chunk_account, winner_account, winning_ticket_id): (
            AccountInfo<'static>,
            AccountInfo<'static>,
            u32,
        ) = if vrf_request == VRF_STUB_MARKER {
            require_eq!(
                ctx.remaining_accounts.len(),
                2,
                ErrorCode::SettleAccountsWrongLen
            );
            let chunk_account: AccountInfo<'static> =
                unsafe { core::mem::transmute(ctx.remaining_accounts[0].clone()) };
            let winner_account: AccountInfo<'static> =
                unsafe { core::mem::transmute(ctx.remaining_accounts[1].clone()) };
            let winning_ticket_id = stub_settle_winning_ticket_id(&draw_key, slot, ts, n)?;
            (chunk_account, winner_account, winning_ticket_id)
        } else {
            require_eq!(
                ctx.remaining_accounts.len(),
                3,
                ErrorCode::SettleSwitchboardAccountsWrongLen
            );
            let randomness_account: AccountInfo<'static> =
                unsafe { core::mem::transmute(ctx.remaining_accounts[0].clone()) };
            let chunk_account: AccountInfo<'static> =
                unsafe { core::mem::transmute(ctx.remaining_accounts[1].clone()) };
            let winner_account: AccountInfo<'static> =
                unsafe { core::mem::transmute(ctx.remaining_accounts[2].clone()) };
            require_keys_eq!(
                randomness_account.key(),
                vrf_request,
                ErrorCode::InvalidRandomnessAccount
            );
            let vrf_data = randomness_account.try_borrow_data()?;
            let vrf_bytes = read_switchboard_randomness_value(&vrf_data, slot)?;
            let winning_ticket_id = winning_ticket_from_vrf_bytes(&vrf_bytes, n)?;
            (chunk_account, winner_account, winning_ticket_id)
        };

        let vault_info: AccountInfo<'static> =
            unsafe { core::mem::transmute(ctx.accounts.prize_vault.to_account_info()) };
        let rent_ai: AccountInfo<'static> =
            unsafe { core::mem::transmute(ctx.accounts.rent.to_account_info()) };
        let chunk_idx = ticket_chunk_index(winning_ticket_id);
        let slot_in_chunk = ticket_slot_in_chunk(winning_ticket_id);

        let (expected_chunk, _) = Pubkey::find_program_address(
            &[b"tickets", draw_key.as_ref(), &chunk_idx.to_le_bytes()],
            ctx.program_id,
        );
        require_keys_eq!(chunk_account.key(), expected_chunk);

        let owner = {
            let data = chunk_account.try_borrow_data()?;
            let pk = read_ticket_chunk_owner(&data, slot_in_chunk)?;
            require_keys_neq!(pk, Pubkey::default(), ErrorCode::EmptyTicketOwner);
            pk
        };
        require_keys_eq!(winner_account.key(), owner, ErrorCode::WinnerMismatch);

        let rent_struct = Rent::from_account_info(&rent_ai)?;
        let min_balance = rent_struct.minimum_balance(vault_info.data_len());
        let available = prize_vault_withdrawable_saturating(vault_info.lamports(), min_balance);

        transfer_prize_vault_lamports(&vault_info, &winner_account, available)?;

        let mut draw = ctx.accounts.draw.load_mut()?;
        draw.winning_ticket_id = winning_ticket_id;
        draw.winner = owner;
        draw.state = DrawState::Settled as u8;
        Ok(())
    }

    /// **Authority-only:** after **`Settled`**, withdraw **all** SPL for one allowlisted `mint` from this draw’s
    /// treasury ATA to the authority’s ATA (`destination_token`; created with **`init_if_needed`**).
    pub fn withdraw_spl(ctx: Context<WithdrawSpl>) -> Result<()> {
        let draw_key = ctx.accounts.draw.key();
        let (draw_state, spl_auth_bump) = {
            let draw = ctx.accounts.draw.load()?;
            (draw.state, draw.spl_auth_bump)
        };
        require!(
            draw_state == DrawState::Settled as u8,
            ErrorCode::InvalidDrawStateForWithdrawSpl
        );
        let mint_key = ctx.accounts.mint.key();
        require!(
            find_spl_row_index(&ctx.accounts.draw, &mint_key).is_some(),
            ErrorCode::MintNotInDraw
        );

        let amount = ctx.accounts.treasury_token.amount;
        if amount == 0 {
            return Ok(());
        }

        let bump = spl_auth_bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"spl_vault_auth", draw_key.as_ref(), &[bump]]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.treasury_token.to_account_info(),
                    to: ctx.accounts.destination_token.to_account_info(),
                    authority: ctx.accounts.spl_vault_authority.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;
        Ok(())
    }
}

/// Sorted unique chunk indices for ticket ids `[base, base + count)`.
pub fn ticket_chunk_indices_for_range(base: u32, count: u32) -> Result<Vec<u32>> {
    let end = base.checked_add(count).ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    let mut out: Vec<u32> = Vec::new();
    let mut ticket_id = base;
    while ticket_id < end {
        let c = ticket_id / (TICKETS_PER_CHUNK as u32);
        if out.last().copied() != Some(c) {
            out.push(c);
        }
        ticket_id = ticket_id
            .checked_add(1)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    }
    Ok(out)
}

fn find_spl_row_index(draw: &AccountLoader<Draw>, mint: &Pubkey) -> Option<usize> {
    let data = draw.load().ok()?;
    find_spl_row_index_in_table(&data.spl_mint_rows, data.spl_count, mint)
}

/// Global ticket id → chunk PDA index (see [`ticket_slot_in_chunk`]).
pub(crate) fn ticket_chunk_index(ticket_id: u32) -> u32 {
    ticket_id / (TICKETS_PER_CHUNK as u32)
}

/// Index within [`TicketChunk::owners`] for a global ticket id.
pub(crate) fn ticket_slot_in_chunk(ticket_id: u32) -> usize {
    let chunk_start = ticket_chunk_index(ticket_id) * (TICKETS_PER_CHUNK as u32);
    (ticket_id - chunk_start) as usize
}

/// After an SPL buy, new `sold` count or [`ErrorCode::SplCapExceeded`] / overflow.
pub(crate) fn spl_apply_buy_to_row(sold: u32, count: u32, cap: u32) -> Result<u32> {
    let new_sold = sold
        .checked_add(count)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    require!(new_sold <= cap, ErrorCode::SplCapExceeded);
    Ok(new_sold)
}

/// SPL tokens debited for `count` tickets at `price_per_ticket` (base units).
pub(crate) fn spl_token_amount_for_buy(price_per_ticket: u64, count: u32) -> Result<u64> {
    price_per_ticket
        .checked_mul(count as u64)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))
}

pub(crate) fn find_spl_row_index_in_table(
    rows: &[SplMintRow; SPL_MINT_MAX],
    spl_count: u8,
    mint: &Pubkey,
) -> Option<usize> {
    let n = spl_count as usize;
    for i in 0..n {
        if rows[i].mint == *mint {
            return Some(i);
        }
    }
    None
}

/// Per-ticket SOL splits for `count` tickets: (prize vault, team, setup).
pub(crate) fn sol_ticket_lamports_splits(count: u32) -> Result<(u64, u64, u64)> {
    let c = count as u64;
    let pot = LAMPORTS_SOL_TICKET_POT
        .checked_mul(c)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    let team = LAMPORTS_SOL_TICKET_TEAM
        .checked_mul(c)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    let setup = LAMPORTS_SOL_TICKET_SETUP
        .checked_mul(c)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    Ok((pot, team, setup))
}

/// **Total** SPL setup fee lamports (`LAMPORTS_SPL_TICKET_FEE_TOTAL * count`). No team vault payment.
pub(crate) fn spl_fee_lamports_total(count: u32) -> Result<u64> {
    LAMPORTS_SPL_TICKET_FEE_TOTAL
        .checked_mul(count as u64)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))
}

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize)]
pub struct SplMintArg {
    pub mint: Pubkey,
    pub price_per_ticket: u64,
    pub mint_decimals: u8,
    pub cap: u32,
}

#[derive(Clone, Copy, Default, AnchorSerialize, AnchorDeserialize, InitSpace)]
#[repr(C)]
pub struct SplMintRow {
    pub mint: Pubkey,
    pub price_per_ticket: u64,
    pub mint_decimals: u8,
    pub cap: u32,
    pub sold: u32,
}

#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum DrawState {
    Selling = 0,
    SalesClosed = 1,
    VrfRequested = 2,
    Settled = 3,
    Refunded = 4,
}

/// One draw: schedule, ticket counts, SPL rows, VRF + settlement slots (filled later).
#[account(zero_copy(unsafe))]
#[repr(C)]
pub struct Draw {
    pub draw_id: u64,
    pub bump: u8,
    pub prize_vault_bump: u8,
    pub sales_open_ts: i64,
    pub sales_close_ts: i64,
    /// [`DrawState`] discriminant.
    pub state: u8,
    pub total_tickets: u32,
    pub seed_refund: Pubkey,
    pub spl_count: u8,
    pub spl_mint_rows: [SplMintRow; SPL_MINT_MAX],
    pub vrf_request: Pubkey,
    pub winning_ticket_id: u32,
    pub winner: Pubkey,
    pub spl_auth_bump: u8,
}

impl Draw {
    pub const ACCOUNT_LEN: usize = 8 + core::mem::size_of::<Self>();
}

/// One chunk of ticket owners (`TICKETS_PER_CHUNK` sequential global ids per PDA).
/// `zero_copy` keeps ticket data off the BPF stack (see Solana 4 KiB frame limit).
#[account(zero_copy(unsafe))]
#[repr(C)]
pub struct TicketChunk {
    pub owners: [Pubkey; TICKETS_PER_CHUNK],
}

impl TicketChunk {
    pub const ACCOUNT_LEN: usize = 8 + core::mem::size_of::<Self>();
}

#[inline]
fn ticket_chunk_owner_offset(slot: usize) -> usize {
    8 + slot * 32
}

/// Read one owner pubkey from a [`TicketChunk`] account buffer (no heap / loader borrow).
pub(crate) fn read_ticket_chunk_owner(data: &[u8], slot: usize) -> Result<Pubkey> {
    let off = ticket_chunk_owner_offset(slot);
    require!(
        data.len() >= off + 32,
        ErrorCode::InvalidChunkAccount
    );
    Ok(Pubkey::new_from_array(
        data[off..off + 32]
            .try_into()
            .map_err(|_| error!(ErrorCode::InvalidChunkAccount))?,
    ))
}

fn write_ticket_chunk_owner(data: &mut [u8], slot: usize, owner: Pubkey) -> Result<()> {
    let off = ticket_chunk_owner_offset(slot);
    require!(
        data.len() >= off + 32,
        ErrorCode::InvalidChunkAccount
    );
    data[off..off + 32].copy_from_slice(owner.as_ref());
    Ok(())
}

/// Write ticket owner pubkeys for global ids `[from, to)` within one chunk.
pub(crate) fn assign_ticket_range(
    chunk_ai: &AccountInfo<'_>,
    chunk_start: u32,
    from: u32,
    to: u32,
    buyer: Pubkey,
) -> Result<()> {
    for ticket_id in from..to {
        let slot = (ticket_id - chunk_start) as usize;
        {
            let data = chunk_ai.try_borrow_data()?;
            let current = read_ticket_chunk_owner(&data, slot)?;
            require!(current == Pubkey::default(), ErrorCode::TicketSlotOccupied);
        }
        let mut data = chunk_ai.try_borrow_mut_data()?;
        write_ticket_chunk_owner(&mut data, slot, buyer)?;
    }
    Ok(())
}

pub(crate) fn require_ticket_chunk_initialized(
    program_id: &Pubkey,
    chunk_ai: &AccountInfo<'_>,
    draw_key: &Pubkey,
    chunk_idx: u32,
) -> Result<()> {
    let (expected_pda, _) = Pubkey::find_program_address(
        &[
            b"tickets",
            draw_key.as_ref(),
            &chunk_idx.to_le_bytes(),
        ],
        program_id,
    );
    require_keys_eq!(chunk_ai.key(), expected_pda);
    require!(
        chunk_ai.owner == program_id && chunk_ai.data_len() >= TicketChunk::ACCOUNT_LEN,
        ErrorCode::TicketChunkNotInitialized
    );
    Ok(())
}

pub(crate) fn ensure_ticket_chunk_initialized(
    program_id: &Pubkey,
    buyer: AccountInfo<'_>,
    chunk_ai: AccountInfo<'_>,
    draw_key: &Pubkey,
    chunk_idx: u32,
    bump: u8,
    system_program: AccountInfo<'_>,
    rent: AccountInfo<'_>,
) -> Result<()> {
    // SAFETY: `AccountInfo` lifetimes from Anchor's `Context` are split across `accounts` vs
    // `remaining_accounts` even though every handle points at the same instruction buffer for the
    // duration of this CPI. Transmuting to `'static` matches common on-chain program practice.
    let buyer: AccountInfo<'static> = unsafe { core::mem::transmute(buyer) };
    let chunk_ai: AccountInfo<'static> = unsafe { core::mem::transmute(chunk_ai) };
    let system_program: AccountInfo<'static> = unsafe { core::mem::transmute(system_program) };
    let rent: AccountInfo<'static> = unsafe { core::mem::transmute(rent) };
    require!(buyer.is_signer, ErrorCode::Unauthorized);
    let space = TicketChunk::ACCOUNT_LEN;
    let rent_struct = Rent::from_account_info(&rent)?;
    let rent_lamports = rent_struct.minimum_balance(space);

    if chunk_ai.owner == program_id && chunk_ai.data_len() >= space {
        return Ok(());
    }

    require!(
        chunk_ai.owner == &anchor_lang::solana_program::system_program::ID && chunk_ai.data_len() == 0,
        ErrorCode::InvalidChunkAccount
    );

    let seeds: &[&[u8]] = &[
        b"tickets",
        draw_key.as_ref(),
        &chunk_idx.to_le_bytes(),
        &[bump],
    ];

    invoke_signed(
        &system_instruction::create_account(
            &buyer.key(),
            &chunk_ai.key(),
            rent_lamports,
            space as u64,
            program_id,
        ),
        &[buyer.clone(), chunk_ai.clone(), system_program.clone()],
        &[seeds],
    )?;

    let mut data = chunk_ai.try_borrow_mut_data()?;
    require!(data.len() >= TicketChunk::ACCOUNT_LEN, ErrorCode::InvalidChunkAccount);
    data[..8].copy_from_slice(&TicketChunk::DISCRIMINATOR);
    Ok(())
}

/// Marker account: holds native SOL for the jackpot (lamports only; discriminator + padding).
#[account]
pub struct PrizeVault {}

impl PrizeVault {
    pub const LEN: usize = 0;
}

/// Global singleton — immutable after init for v1 (no `update_config`).
#[account]
pub struct GlobalConfig {
    pub team_vault: Pubkey,
    pub bux_vault: Pubkey,
    pub setup_vault: Pubkey,
    pub authority: Pubkey,
    /// Monotonic: next `create_draw` receives this id, then increments.
    pub next_draw_id: u64,
    pub bump: u8,
}

impl GlobalConfig {
    pub const LEN: usize = 32 + 32 + 32 + 32 + 8 + 1;
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + GlobalConfig::LEN,
        seeds = [b"global_config"],
        bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(sales_open_ts: i64, sales_close_ts: i64, seed_refund: Pubkey, seed_lamports: u64, spl_rows: Vec<SplMintArg>)]
pub struct CreateDraw<'info> {
    #[account(mut, constraint = authority.key() == global_config.authority @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"global_config"], bump = global_config.bump)]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(
        init,
        payer = authority,
        space = Draw::ACCOUNT_LEN,
        seeds = [b"draw".as_ref(), global_config.next_draw_id.to_le_bytes().as_ref()],
        bump
    )]
    pub draw: AccountLoader<'info, Draw>,
    #[account(
        init,
        payer = authority,
        space = 8 + PrizeVault::LEN,
        seeds = [b"prize_vault", draw.key().as_ref()],
        bump
    )]
    pub prize_vault: Account<'info, PrizeVault>,
    #[account(
        init,
        payer = authority,
        space = TicketChunk::ACCOUNT_LEN,
        seeds = [b"tickets", draw.key().as_ref(), &0u32.to_le_bytes()],
        bump
    )]
    pub ticket_chunk_0: AccountLoader<'info, TicketChunk>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(chunk_index: u32)]
pub struct InitTicketChunk<'info> {
    #[account(mut, constraint = authority.key() == global_config.authority @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(seeds = [b"global_config"], bump = global_config.bump)]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub draw: AccountLoader<'info, Draw>,
    #[account(
        init,
        payer = authority,
        space = TicketChunk::ACCOUNT_LEN,
        seeds = [b"tickets", draw.key().as_ref(), &chunk_index.to_le_bytes()],
        bump
    )]
    pub ticket_chunk: AccountLoader<'info, TicketChunk>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AddSplMintToDraw<'info> {
    #[account(mut, constraint = authority.key() == global_config.authority @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(seeds = [b"global_config"], bump = global_config.bump)]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub draw: AccountLoader<'info, Draw>,
}

#[derive(Accounts)]
#[instruction(count: u32)]
pub struct BuySolTickets<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub draw: AccountLoader<'info, Draw>,
    #[account(
        mut,
        seeds = [b"prize_vault", draw.key().as_ref()],
        bump
    )]
    pub prize_vault: Account<'info, PrizeVault>,
    #[account(seeds = [b"global_config"], bump = global_config.bump)]
    pub global_config: Account<'info, GlobalConfig>,
    /// CHECK: team SOL recipient from global config.
    #[account(mut, constraint = team_vault.key() == global_config.team_vault @ ErrorCode::InvalidTeamVault)]
    pub team_vault: UncheckedAccount<'info>,
    /// CHECK: BUX project SOL recipient from global config.
    #[account(mut, constraint = bux_vault.key() == global_config.bux_vault @ ErrorCode::InvalidBuxVault)]
    pub bux_vault: UncheckedAccount<'info>,
    /// CHECK: setup SOL recipient from global config.
    #[account(mut, constraint = setup_vault.key() == global_config.setup_vault @ ErrorCode::InvalidSetupVault)]
    pub setup_vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
#[instruction(count: u32)]
pub struct BuySplTickets<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub draw: AccountLoader<'info, Draw>,
    #[account(seeds = [b"global_config"], bump = global_config.bump)]
    pub global_config: Account<'info, GlobalConfig>,
    pub mint: Account<'info, Mint>,
    /// CHECK: team wallet from global config (SPL recipient at purchase).
    #[account(constraint = team_vault.key() == global_config.team_vault @ ErrorCode::InvalidTeamVault)]
    pub team_vault: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = buyer,
    )]
    pub buyer_token: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = team_vault,
    )]
    pub team_token: Account<'info, TokenAccount>,
    /// CHECK: setup SOL recipient from global config (SPL ticket fee only).
    #[account(mut, constraint = setup_vault.key() == global_config.setup_vault @ ErrorCode::InvalidSetupVault)]
    pub setup_vault: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct CloseSales<'info> {
    #[account(mut)]
    pub draw: AccountLoader<'info, Draw>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct RefundEmptyDraw<'info> {
    #[account(mut)]
    pub draw: AccountLoader<'info, Draw>,
    #[account(
        mut,
        seeds = [b"prize_vault", draw.key().as_ref()],
        bump
    )]
    pub prize_vault: Account<'info, PrizeVault>,
    /// CHECK: must match `draw.seed_refund` (validated in instruction).
    #[account(mut)]
    pub seed_refund: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct RequestVrf<'info> {
    #[account(mut)]
    pub draw: AccountLoader<'info, Draw>,
}

#[derive(Accounts)]
pub struct SettleDraw<'info> {
    #[account(mut)]
    pub draw: AccountLoader<'info, Draw>,
    #[account(
        mut,
        seeds = [b"prize_vault", draw.key().as_ref()],
        bump
    )]
    pub prize_vault: Account<'info, PrizeVault>,
    pub clock: Sysvar<'info, Clock>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawSpl<'info> {
    #[account(mut, constraint = authority.key() == global_config.authority @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(seeds = [b"global_config"], bump = global_config.bump)]
    pub global_config: Account<'info, GlobalConfig>,
    pub draw: AccountLoader<'info, Draw>,
    pub mint: Account<'info, Mint>,
    /// CHECK: SPL treasury signer PDA (matches `draw.spl_auth_bump`).
    #[account(seeds = [b"spl_vault_auth", draw.key().as_ref()], bump)]
    pub spl_vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = spl_vault_authority,
    )]
    pub treasury_token: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = authority,
    )]
    pub destination_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("signer is not the configured authority")]
    Unauthorized,
    #[msg("sales_close_ts must be greater than sales_open_ts")]
    InvalidSchedule,
    #[msg("too many SPL mints for one draw")]
    TooManySplMints,
    #[msg("SPL mint already registered on this draw")]
    SplMintAlreadyInDraw,
    #[msg("unexpected remaining accounts on this instruction")]
    UnexpectedRemainingAccounts,
    #[msg("SPL per-mint cap must be > 0")]
    InvalidSplCap,
    #[msg("SPL price must be > 0")]
    InvalidSplPrice,
    #[msg("draw id counter overflow")]
    DrawIdOverflow,
    #[msg("draw is not accepting ticket sales")]
    WrongDrawState,
    #[msg("ticket sales are not open at this time")]
    OutsideSalesWindow,
    #[msg("invalid ticket count for this instruction")]
    InvalidTicketCount,
    #[msg("arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("team vault does not match global config")]
    InvalidTeamVault,
    #[msg("BUX vault does not match global config")]
    InvalidBuxVault,
    #[msg("setup vault does not match global config")]
    InvalidSetupVault,
    #[msg("remaining ticket chunk accounts missing or out of order")]
    InvalidChunkAccounts,
    #[msg("invalid ticket chunk PDA account")]
    InvalidChunkAccount,
    #[msg("ticket chunk PDA not initialized — admin must create it before sales")]
    TicketChunkNotInitialized,
    #[msg("ticket slot already occupied")]
    TicketSlotOccupied,
    #[msg("mint is not allowlisted for this draw")]
    MintNotInDraw,
    #[msg("SPL per-mint cap exceeded")]
    SplCapExceeded,
    #[msg("mint decimals do not match draw config")]
    SplMintDecimalsMismatch,
    #[msg("draw must be Selling to close sales")]
    InvalidDrawStateForCloseSales,
    #[msg("sales_close_ts has not been reached yet")]
    SalesPeriodNotEnded,
    #[msg("draw must be SalesClosed to refund empty draw")]
    InvalidDrawStateForRefund,
    #[msg("cannot refund: tickets were sold")]
    RefundDrawHasTickets,
    #[msg("seed_refund account must match draw.seed_refund")]
    InvalidSeedRefund,
    #[msg("draw must be SalesClosed to request VRF")]
    InvalidDrawStateForVrf,
    #[msg("VRF requires at least one ticket sold")]
    VrfNeedsTickets,
    #[msg("VRF already requested for this draw")]
    VrfAlreadyRequested,
    #[msg("draw must be VrfRequested to settle")]
    InvalidDrawStateForSettle,
    #[msg("request_vrf Switchboard mode requires [randomness_account] remaining account")]
    RequestVrfAccountsWrongLen,
    #[msg("randomness account owner is not Switchboard On-Demand")]
    InvalidRandomnessAccount,
    #[msg("Switchboard randomness not resolved yet — run reveal before settle")]
    RandomnessNotResolved,
    #[msg("settle stub requires [ticket_chunk, winner] remaining accounts")]
    SettleAccountsWrongLen,
    #[msg("settle Switchboard requires [randomness, ticket_chunk, winner] remaining accounts")]
    SettleSwitchboardAccountsWrongLen,
    #[msg("winning ticket owner is missing on-chain")]
    EmptyTicketOwner,
    #[msg("winner account does not match ticket owner")]
    WinnerMismatch,
    #[msg("draw must be Settled to withdraw SPL")]
    InvalidDrawStateForWithdrawSpl,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ticket_chunk_single_chunk() {
        assert_eq!(ticket_chunk_indices_for_range(0, 1).unwrap(), vec![0]);
        assert_eq!(ticket_chunk_indices_for_range(0, 3).unwrap(), vec![0]);
        assert_eq!(ticket_chunk_indices_for_range(250, 5).unwrap(), vec![0]);
    }

    #[test]
    fn ticket_chunk_cross_one_boundary() {
        let p = TICKETS_PER_CHUNK as u32;
        assert_eq!(ticket_chunk_indices_for_range(p - 1, 2).unwrap(), vec![0, 1]);
        assert_eq!(ticket_chunk_indices_for_range(p, 1).unwrap(), vec![1]);
    }

    #[test]
    fn ticket_chunk_three_chunks() {
        let p = TICKETS_PER_CHUNK as u32;
        assert_eq!(
            ticket_chunk_indices_for_range(0, 2 * p + 1).unwrap(),
            vec![0, 1, 2]
        );
    }

    #[test]
    fn ticket_chunk_zero_count_empty() {
        assert!(ticket_chunk_indices_for_range(10, 0).unwrap().is_empty());
    }

    #[test]
    fn sol_ticket_per_ticket_constants_sum_to_total() {
        assert_eq!(
            LAMPORTS_SOL_TICKET_POT
                + LAMPORTS_SOL_TICKET_TEAM
                + LAMPORTS_SOL_TICKET_BUX
                + LAMPORTS_SOL_TICKET_SETUP,
            LAMPORTS_SOL_TICKET_TOTAL
        );
    }

    #[test]
    fn sol_ticket_lamports_splits_bulk() {
        let (pot, team, setup) = sol_ticket_lamports_splits(3).unwrap();
        assert_eq!(pot, LAMPORTS_SOL_TICKET_POT * 3);
        assert_eq!(team, LAMPORTS_SOL_TICKET_TEAM * 3);
        assert_eq!(setup, LAMPORTS_SOL_TICKET_SETUP * 3);
        assert_eq!(
            pot + team + setup,
            LAMPORTS_SOL_TICKET_TOTAL * 3 - LAMPORTS_SOL_TICKET_BUX * 3
        );
    }

    #[test]
    fn spl_fee_total_one_ticket() {
        assert_eq!(spl_fee_lamports_total(1).unwrap(), LAMPORTS_SPL_TICKET_FEE_TOTAL);
    }

    #[test]
    fn spl_fee_total_bulk() {
        assert_eq!(spl_fee_lamports_total(3).unwrap(), LAMPORTS_SPL_TICKET_FEE_TOTAL * 3);
    }

    #[test]
    fn prize_vault_withdrawable_checked_ok() {
        assert_eq!(
            prize_vault_withdrawable_checked(2_000_000, 890_880).unwrap(),
            1_109_120
        );
    }

    #[test]
    fn prize_vault_withdrawable_checked_underflow_err() {
        assert!(prize_vault_withdrawable_checked(100, 200).is_err());
    }

    #[test]
    fn prize_vault_withdrawable_saturating_clamps() {
        assert_eq!(
            prize_vault_withdrawable_saturating(2_000_000, 890_880),
            1_109_120
        );
        assert_eq!(prize_vault_withdrawable_saturating(100, 200), 0);
    }

    #[test]
    fn pda_prize_vault_stable() {
        let pid = id();
        let draw = Pubkey::new_unique();
        let (a, _) = Pubkey::find_program_address(&[b"prize_vault", draw.as_ref()], &pid);
        let (b, _) = Pubkey::find_program_address(&[b"prize_vault", draw.as_ref()], &pid);
        assert_eq!(a, b);
    }

    #[test]
    fn stub_settle_roll_single_ticket_is_zero() {
        let k = Pubkey::new_unique();
        assert_eq!(
            stub_settle_winning_ticket_id(&k, 100, 1_700_000_000, 1).unwrap(),
            0
        );
    }

    #[test]
    fn stub_settle_roll_deterministic() {
        let k = Pubkey::new_unique();
        let a = stub_settle_winning_ticket_id(&k, 42, 99, 17).unwrap();
        let b = stub_settle_winning_ticket_id(&k, 42, 99, 17).unwrap();
        assert_eq!(a, b);
        assert!(a < 17);
    }

    #[test]
    fn stub_settle_roll_rejects_zero_tickets() {
        let k = Pubkey::new_unique();
        assert!(stub_settle_winning_ticket_id(&k, 1, 0, 0).is_err());
    }

    #[test]
    fn stub_settle_roll_bounded() {
        let k = Pubkey::new_unique();
        for n in [1u32, 2, 17, 256, 10_000] {
            let w = stub_settle_winning_ticket_id(&k, 9_999, 1_700_000_000, n).unwrap();
            assert!(w < n);
        }
    }

    #[test]
    fn vrf_bytes_maps_to_ticket_index() {
        let mut bytes = [0u8; 32];
        bytes[0] = 7;
        assert_eq!(winning_ticket_from_vrf_bytes(&bytes, 10).unwrap(), 7);
        assert_eq!(winning_ticket_from_vrf_bytes(&bytes, 1).unwrap(), 0);
    }

    #[test]
    fn spl_apply_buy_fills_to_cap_exactly() {
        assert_eq!(spl_apply_buy_to_row(9, 1, 10).unwrap(), 10);
        assert_eq!(spl_apply_buy_to_row(0, 10, 10).unwrap(), 10);
    }

    #[test]
    fn spl_apply_buy_rejects_over_cap() {
        assert!(spl_apply_buy_to_row(10, 1, 10).is_err());
        assert!(spl_apply_buy_to_row(8, 3, 10).is_err());
    }

    #[test]
    fn spl_apply_buy_rejects_u32_overflow() {
        assert!(spl_apply_buy_to_row(u32::MAX, 1, u32::MAX).is_err());
    }

    #[test]
    fn spl_token_amount_for_buy_ok_and_overflow() {
        assert_eq!(spl_token_amount_for_buy(1_000_000, 3).unwrap(), 3_000_000);
        assert!(spl_token_amount_for_buy(u64::MAX, 2).is_err());
    }

    #[test]
    fn ticket_chunk_index_and_slot_roundtrip() {
        assert_eq!(ticket_chunk_index(0), 0);
        assert_eq!(ticket_slot_in_chunk(0), 0);
        let p = TICKETS_PER_CHUNK as u32;
        assert_eq!(ticket_chunk_index(p - 1), 0);
        assert_eq!(ticket_slot_in_chunk(p - 1), (p - 1) as usize);
        assert_eq!(ticket_chunk_index(p), 1);
        assert_eq!(ticket_slot_in_chunk(p), 0);
        assert_eq!(ticket_chunk_index(2 * p + 17), 2);
        assert_eq!(ticket_slot_in_chunk(2 * p + 17), 17);
    }

    #[test]
    fn find_spl_row_index_in_table_first_match() {
        let mut rows = [SplMintRow::default(); SPL_MINT_MAX];
        let m0 = Pubkey::new_unique();
        let m1 = Pubkey::new_unique();
        rows[0].mint = m0;
        rows[1].mint = m1;
        assert_eq!(find_spl_row_index_in_table(&rows, 2, &m0), Some(0));
        assert_eq!(find_spl_row_index_in_table(&rows, 2, &m1), Some(1));
        assert_eq!(find_spl_row_index_in_table(&rows, 2, &Pubkey::new_unique()), None);
        assert_eq!(find_spl_row_index_in_table(&rows, 1, &m1), None);
    }
}
