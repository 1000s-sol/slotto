//! Slotto lottery program — Anchor v1.
//! Spec: `docs/onchain-lottery-v1-spec.md`. Run `anchor keys sync` so `declare_id!` matches deploy keys.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFTE24");

/// Max SPL mints inlined on [`Draw`] (see spec).
pub const SPL_MINT_MAX: usize = 16;

/// Owners per [`TicketChunk`] PDA (see spec).
pub const TICKETS_PER_CHUNK: usize = 256;

/// Per SOL ticket: **0.009** SOL → prize vault (lamports).
pub const LAMPORTS_SOL_TICKET_POT: u64 = 9_000_000;
/// Per SOL ticket: **0.001** SOL → team (lamports).
pub const LAMPORTS_SOL_TICKET_TEAM: u64 = 1_000_000;
/// Per SOL ticket: **0.0005** SOL → setup (lamports).
pub const LAMPORTS_SOL_TICKET_SETUP: u64 = 500_000;
/// Per SOL ticket total charged: **0.0105** SOL (lamports).
pub const LAMPORTS_SOL_TICKET_TOTAL: u64 = 10_500_000;

/// Hard cap per tx so chunk `remaining_accounts` + compute stay bounded.
pub const MAX_SOL_TICKETS_PER_BUY: u32 = 256;

/// Same cap for SPL buys (per tx).
pub const MAX_SPL_TICKETS_PER_BUY: u32 = 256;

/// Per SPL ticket: **0.0005** SOL total fee (lamports), paid like the non-pot slice of a SOL ticket.
pub const LAMPORTS_SPL_TICKET_FEE_TOTAL: u64 = 500_000;

#[program]
pub mod slotto_lottery {
    use super::*;

    /// One-time program config: team + setup SOL recipients, draw authority, `next_draw_id` counter.
    pub fn initialize(ctx: Context<Initialize>, team_vault: Pubkey, setup_vault: Pubkey) -> Result<()> {
        require_keys_neq!(team_vault, Pubkey::default());
        require_keys_neq!(setup_vault, Pubkey::default());

        let cfg = &mut ctx.accounts.global_config;
        cfg.team_vault = team_vault;
        cfg.setup_vault = setup_vault;
        cfg.authority = ctx.accounts.authority.key();
        cfg.next_draw_id = 0;
        cfg.bump = ctx.bumps.global_config;
        Ok(())
    }

    /// Authority opens a new draw: schedule, optional seed SOL into prize vault, SPL mint table (rows only).
    ///
    /// SPL treasury ATAs (authority PDA `["spl_vault_auth", draw]`) are created in `buy_spl_tickets` via
    /// `init_if_needed` to keep this instruction small and rent-predictable.
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
        require!(ctx.remaining_accounts.is_empty(), ErrorCode::UnexpectedRemainingAccounts);

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
            let draw = &mut ctx.accounts.draw;
            draw.draw_id = draw_id;
            draw.bump = ctx.bumps.draw;
            draw.prize_vault_bump = ctx.bumps.prize_vault;
            draw.sales_open_ts = sales_open_ts;
            draw.sales_close_ts = sales_close_ts;
            draw.state = DrawState::Selling as u8;
            draw.total_tickets = 0;
            draw.seed_refund = refund;
            draw.spl_count = spl_rows.len() as u8;
            draw.spl_mint_rows = [SplMintRow::default(); SPL_MINT_MAX];
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

        ctx.accounts.global_config.next_draw_id = draw_id
            .checked_add(1)
            .ok_or(error!(ErrorCode::DrawIdOverflow))?;

        Ok(())
    }

    /// Buy `count` SOL tickets while sales are open. **Remaining accounts:** one account per touched
    /// ticket-chunk PDA, **sorted ascending by chunk index** (see `ticket_chunk_indices_for_range`).
    pub fn buy_sol_tickets(ctx: Context<BuySolTickets>, count: u32) -> Result<()> {
        require!(count > 0 && count <= MAX_SOL_TICKETS_PER_BUY, ErrorCode::InvalidTicketCount);

        let base = ctx.accounts.draw.total_tickets;
        let draw_state = ctx.accounts.draw.state;
        let draw_key = ctx.accounts.draw.key();
        let sales_open = ctx.accounts.draw.sales_open_ts;
        let sales_close = ctx.accounts.draw.sales_close_ts;

        require!(draw_state == DrawState::Selling as u8, ErrorCode::WrongDrawState);

        let now = ctx.accounts.clock.unix_timestamp;
        require!(
            now >= sales_open && now < sales_close,
            ErrorCode::OutsideSalesWindow
        );

        let new_total = base
            .checked_add(count)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;

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
            let (expected_pda, bump) = Pubkey::find_program_address(
                &[
                    b"tickets",
                    draw_key.as_ref(),
                    &chunk_idx.to_le_bytes(),
                ],
                program_id,
            );
            require_keys_eq!(chunk_ai.key(), expected_pda);

            ensure_ticket_chunk_initialized(
                program_id,
                &ctx.accounts.buyer,
                chunk_ai,
                &draw_key,
                chunk_idx,
                bump,
                &ctx.accounts.system_program,
                &ctx.accounts.rent,
            )?;

            let chunk_start = chunk_idx
                .checked_mul(TICKETS_PER_CHUNK as u32)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
            let chunk_end = chunk_start
                .checked_add(TICKETS_PER_CHUNK as u32)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
            let from = base.max(chunk_start);
            let to = new_total.min(chunk_end);

            {
                let data_ro = chunk_ai.try_borrow_data()?;
                let mut slice: &[u8] = &data_ro[..];
                let mut tc = TicketChunk::try_deserialize(&mut slice)?;
                drop(data_ro);

                for ticket_id in from..to {
                    let slot = (ticket_id - chunk_start) as usize;
                    require!(tc.owners[slot] == Pubkey::default(), ErrorCode::TicketSlotOccupied);
                    tc.owners[slot] = buyer_key;
                }

                let mut data = chunk_ai.try_borrow_mut_data()?;
                let mut writer: &mut [u8] = &mut data[..];
                tc.try_serialize(&mut writer)?;
            }
        }

        ctx.accounts.draw.total_tickets = new_total;
        Ok(())
    }

    /// Buy `count` SPL tickets for `mint` (allowlisted on the draw). SPL → treasury ATA; **0.0005 SOL × count**
    /// fee split team:setup in the same **2:1** ratio as the non-pot part of a SOL ticket (`1_000_000` : `500_000`).
    ///
    /// **Remaining accounts:** same as [`buy_sol_tickets`] — ticket chunk PDAs, sorted by chunk index.
    pub fn buy_spl_tickets(ctx: Context<BuySplTickets>, count: u32) -> Result<()> {
        require!(count > 0 && count <= MAX_SPL_TICKETS_PER_BUY, ErrorCode::InvalidTicketCount);

        let mint_key = ctx.accounts.mint.key();
        let row_ix = find_spl_row_index(&ctx.accounts.draw, &mint_key).ok_or(ErrorCode::MintNotInDraw)?;
        let row = ctx.accounts.draw.spl_mint_rows[row_ix];
        require_keys_neq!(row.mint, Pubkey::default());
        require!(ctx.accounts.mint.decimals == row.mint_decimals, ErrorCode::SplMintDecimalsMismatch);

        let new_sold = row
            .sold
            .checked_add(count)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
        require!(new_sold <= row.cap, ErrorCode::SplCapExceeded);

        let base = ctx.accounts.draw.total_tickets;
        let draw_state = ctx.accounts.draw.state;
        let draw_key = ctx.accounts.draw.key();
        let sales_open = ctx.accounts.draw.sales_open_ts;
        let sales_close = ctx.accounts.draw.sales_close_ts;

        require!(draw_state == DrawState::Selling as u8, ErrorCode::WrongDrawState);

        let now = ctx.accounts.clock.unix_timestamp;
        require!(
            now >= sales_open && now < sales_close,
            ErrorCode::OutsideSalesWindow
        );

        let new_total = base
            .checked_add(count)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;

        let spl_amount = row
            .price_per_ticket
            .checked_mul(count as u64)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;

        let (fee_team, fee_setup) = spl_fee_lamports_split(count)?;

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
                    to: ctx.accounts.team_vault.to_account_info(),
                },
            ),
            fee_team,
        )?;
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
                    to: ctx.accounts.treasury_token.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            spl_amount,
        )?;

        for (i, &chunk_idx) in chunk_indices.iter().enumerate() {
            let chunk_ai = &ctx.remaining_accounts[i];
            let (expected_pda, bump) = Pubkey::find_program_address(
                &[
                    b"tickets",
                    draw_key.as_ref(),
                    &chunk_idx.to_le_bytes(),
                ],
                program_id,
            );
            require_keys_eq!(chunk_ai.key(), expected_pda);

            ensure_ticket_chunk_initialized(
                program_id,
                &ctx.accounts.buyer,
                chunk_ai,
                &draw_key,
                chunk_idx,
                bump,
                &ctx.accounts.system_program,
                &ctx.accounts.rent,
            )?;

            let chunk_start = chunk_idx
                .checked_mul(TICKETS_PER_CHUNK as u32)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
            let chunk_end = chunk_start
                .checked_add(TICKETS_PER_CHUNK as u32)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
            let from = base.max(chunk_start);
            let to = new_total.min(chunk_end);

            {
                let data_ro = chunk_ai.try_borrow_data()?;
                let mut slice: &[u8] = &data_ro[..];
                let mut tc = TicketChunk::try_deserialize(&mut slice)?;
                drop(data_ro);

                for ticket_id in from..to {
                    let slot = (ticket_id - chunk_start) as usize;
                    require!(tc.owners[slot] == Pubkey::default(), ErrorCode::TicketSlotOccupied);
                    tc.owners[slot] = buyer_key;
                }

                let mut data = chunk_ai.try_borrow_mut_data()?;
                let mut writer: &mut [u8] = &mut data[..];
                tc.try_serialize(&mut writer)?;
            }
        }

        let draw = &mut ctx.accounts.draw;
        draw.total_tickets = new_total;
        draw.spl_mint_rows[row_ix].sold = new_sold;
        Ok(())
    }

    /// Permissionless: once `now >= sales_close_ts`, move draw from **Selling** → **SalesClosed** (no more tickets).
    pub fn close_sales(ctx: Context<CloseSales>) -> Result<()> {
        require!(
            ctx.accounts.draw.state == DrawState::Selling as u8,
            ErrorCode::InvalidDrawStateForCloseSales
        );
        let now = ctx.accounts.clock.unix_timestamp;
        require!(
            now >= ctx.accounts.draw.sales_close_ts,
            ErrorCode::SalesPeriodNotEnded
        );
        ctx.accounts.draw.state = DrawState::SalesClosed as u8;
        Ok(())
    }

    /// Permissionless: after **SalesClosed**, if **`total_tickets == 0`**, send prize vault SOL (above rent-exempt
    /// minimum for the vault account) to **`seed_refund`**, then **Refunded**.
    pub fn refund_empty_draw(ctx: Context<RefundEmptyDraw>) -> Result<()> {
        require!(
            ctx.accounts.draw.state == DrawState::SalesClosed as u8,
            ErrorCode::InvalidDrawStateForRefund
        );
        require!(
            ctx.accounts.draw.total_tickets == 0,
            ErrorCode::RefundDrawHasTickets
        );

        let draw_key = ctx.accounts.draw.key();
        let bump = ctx.accounts.draw.prize_vault_bump;
        let vault_info = ctx.accounts.prize_vault.to_account_info();
        let min_balance = ctx
            .accounts
            .rent
            .minimum_balance(vault_info.data_len());
        let vault_lamports = **vault_info.try_borrow_lamports()?;
        let available = vault_lamports
            .checked_sub(min_balance)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;

        if available > 0 {
            let seeds: &[&[u8]] = &[b"prize_vault", draw_key.as_ref(), &[bump]];
            invoke_signed(
                &system_instruction::transfer(
                    vault_info.key,
                    ctx.accounts.seed_refund.key,
                    available,
                ),
                &[
                    vault_info.clone(),
                    ctx.accounts.seed_refund.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                &[seeds],
            )?;
        }

        ctx.accounts.draw.state = DrawState::Refunded as u8;
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

fn find_spl_row_index(draw: &Draw, mint: &Pubkey) -> Option<usize> {
    let n = draw.spl_count as usize;
    for i in 0..n {
        if draw.spl_mint_rows[i].mint == *mint {
            return Some(i);
        }
    }
    None
}

/// Split **total** SPL fee lamports (`LAMPORTS_SPL_TICKET_FEE_TOTAL * count`) in **2:1** team:setup ratio (matches `1_000_000` : `500_000` from SOL ticket margins).
fn spl_fee_lamports_split(count: u32) -> Result<(u64, u64)> {
    let total: u128 = (LAMPORTS_SPL_TICKET_FEE_TOTAL as u128)
        .checked_mul(count as u128)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    let team: u128 = total
        .checked_mul(1_000_000)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?
        .checked_div(1_500_000)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    let setup: u128 = total
        .checked_sub(team)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    Ok((team as u64, setup as u64))
}

fn ensure_ticket_chunk_initialized<'info>(
    program_id: &Pubkey,
    buyer: &Signer<'info>,
    chunk_ai: &AccountInfo<'info>,
    draw_key: &Pubkey,
    chunk_idx: u32,
    bump: u8,
    system_program: &Program<'info, System>,
    rent: &Sysvar<'info, Rent>,
) -> Result<()> {
    let space = 8 + TicketChunk::INIT_SPACE;
    let rent_lamports = rent.minimum_balance(space);

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
            buyer.key(),
            chunk_ai.key(),
            rent_lamports,
            space as u64,
            program_id,
        ),
        &[
            buyer.to_account_info(),
            chunk_ai.clone(),
            system_program.to_account_info(),
        ],
        &[seeds],
    )?;

    let tc = TicketChunk {
        owners: [Pubkey::default(); TICKETS_PER_CHUNK],
    };
    let mut data = chunk_ai.try_borrow_mut_data()?;
    let mut w: &mut [u8] = &mut data[..];
    tc.try_serialize(&mut w)?;
    Ok(())
}

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize)]
pub struct SplMintArg {
    pub mint: Pubkey,
    pub price_per_ticket: u64,
    pub mint_decimals: u8,
    pub cap: u32,
}

#[derive(Clone, Copy, Default, AnchorSerialize, AnchorDeserialize, InitSpace)]
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
#[account]
#[derive(InitSpace)]
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

/// One chunk of ticket owners (`TICKETS_PER_CHUNK` sequential global ids per PDA).
#[account]
#[derive(InitSpace)]
pub struct TicketChunk {
    pub owners: [Pubkey; TICKETS_PER_CHUNK],
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
    pub setup_vault: Pubkey,
    pub authority: Pubkey,
    /// Monotonic: next `create_draw` receives this id, then increments.
    pub next_draw_id: u64,
    pub bump: u8,
}

impl GlobalConfig {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 1;
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
        space = 8 + Draw::INIT_SPACE,
        seeds = [b"draw", &global_config.next_draw_id.to_le_bytes()],
        bump
    )]
    pub draw: Account<'info, Draw>,
    #[account(
        init,
        payer = authority,
        space = 8 + PrizeVault::LEN,
        seeds = [b"prize_vault", draw.key().as_ref()],
        bump
    )]
    pub prize_vault: Account<'info, PrizeVault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(count: u32)]
pub struct BuySolTickets<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub draw: Account<'info, Draw>,
    #[account(
        mut,
        seeds = [b"prize_vault", draw.key().as_ref()],
        bump = draw.prize_vault_bump
    )]
    pub prize_vault: Account<'info, PrizeVault>,
    #[account(seeds = [b"global_config"], bump = global_config.bump)]
    pub global_config: Account<'info, GlobalConfig>,
    /// CHECK: team SOL recipient from global config.
    #[account(mut, constraint = team_vault.key() == global_config.team_vault @ ErrorCode::InvalidTeamVault)]
    pub team_vault: UncheckedAccount<'info>,
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
    pub draw: Account<'info, Draw>,
    #[account(seeds = [b"global_config"], bump = global_config.bump)]
    pub global_config: Account<'info, GlobalConfig>,
    pub mint: Account<'info, Mint>,
    /// CHECK: PDA authority for SPL treasury ATAs (matches `draw.spl_auth_bump`).
    #[account(
        seeds = [b"spl_vault_auth", draw.key().as_ref()],
        bump = draw.spl_auth_bump
    )]
    pub spl_vault_authority: UncheckedAccount<'info>,
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
        associated_token::authority = spl_vault_authority,
    )]
    pub treasury_token: Account<'info, TokenAccount>,
    /// CHECK: team SOL recipient from global config.
    #[account(mut, constraint = team_vault.key() == global_config.team_vault @ ErrorCode::InvalidTeamVault)]
    pub team_vault: UncheckedAccount<'info>,
    /// CHECK: setup SOL recipient from global config.
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
    pub draw: Account<'info, Draw>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct RefundEmptyDraw<'info> {
    #[account(mut)]
    pub draw: Account<'info, Draw>,
    #[account(
        mut,
        seeds = [b"prize_vault", draw.key().as_ref()],
        bump = draw.prize_vault_bump
    )]
    pub prize_vault: Account<'info, PrizeVault>,
    /// CHECK: must match `draw.seed_refund` (receives returned seed SOL).
    #[account(mut, constraint = seed_refund.key() == draw.seed_refund @ ErrorCode::InvalidSeedRefund)]
    pub seed_refund: UncheckedAccount<'info>,
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
    #[msg("setup vault does not match global config")]
    InvalidSetupVault,
    #[msg("remaining ticket chunk accounts missing or out of order")]
    InvalidChunkAccounts,
    #[msg("invalid ticket chunk PDA account")]
    InvalidChunkAccount,
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
}
