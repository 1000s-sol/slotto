//! Slotto lottery program — Anchor v1.
//! Spec: `docs/onchain-lottery-v1-spec.md`. Run `anchor keys sync` so `declare_id!` matches deploy keys.

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFTE24");

/// Max SPL mints inlined on [`Draw`] (see spec).
pub const SPL_MINT_MAX: usize = 16;

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
}
