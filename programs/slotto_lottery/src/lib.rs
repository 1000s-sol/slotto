//! Slotto lottery program — Anchor v1 scaffold.
//! Spec: `docs/onchain-lottery-v1-spec.md`. After `anchor keys sync`, program id matches `Anchor.toml` + `.env`.

use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFTE24");

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
