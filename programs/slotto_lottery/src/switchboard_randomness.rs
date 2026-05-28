//! Minimal Switchboard On-Demand randomness account parsing (layout from SDK v0.10.x).
//! Avoids the `switchboard-on-demand` crate so SBF builds stay on Anchor 0.30 / Solana cargo 1.84.

use anchor_lang::prelude::*;

/// Switchboard On-Demand program (mainnet). Matches `@switchboard-xyz/on-demand` `ON_DEMAND_MAINNET_PID`.
pub const ON_DEMAND_MAINNET_PID: Pubkey =
    pubkey!("SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv");

/// Switchboard On-Demand program (devnet). Matches `@switchboard-xyz/on-demand` `ON_DEMAND_DEVNET_PID`.
pub const ON_DEMAND_DEVNET_PID: Pubkey =
    pubkey!("Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2");

/// Minimum account size for [`RandomnessAccountData`] (8-byte disc + fields).
const RANDOMNESS_ACCOUNT_MIN_LEN: usize = 184;

pub fn is_switchboard_randomness_owner(owner: &Pubkey) -> bool {
    *owner == ON_DEMAND_MAINNET_PID || *owner == ON_DEMAND_DEVNET_PID
}

/// Read revealed 32-byte value after Switchboard reveal (matches SDK `get_value` rules).
pub fn read_switchboard_randomness_value(
    data: &[u8],
    clock_slot: u64,
) -> Result<[u8; 32]> {
    require!(
        data.len() >= RANDOMNESS_ACCOUNT_MIN_LEN,
        crate::ErrorCode::InvalidRandomnessAccount
    );

    let reveal_slot = u64::from_le_bytes(
        data[144..152]
            .try_into()
            .map_err(|_| error!(crate::ErrorCode::InvalidRandomnessAccount))?,
    );
    require!(reveal_slot > 0, crate::ErrorCode::RandomnessNotResolved);
    require!(
        clock_slot >= reveal_slot,
        crate::ErrorCode::RandomnessNotResolved
    );

    let value: [u8; 32] = data[152..184]
        .try_into()
        .map_err(|_| error!(crate::ErrorCode::InvalidRandomnessAccount))?;
    require!(
        value != [0u8; 32],
        crate::ErrorCode::RandomnessNotResolved
    );

    Ok(value)
}

/// Map 32-byte VRF output to ticket index in `[0, total_tickets)`.
pub fn winning_ticket_from_vrf_bytes(bytes: &[u8; 32], total_tickets: u32) -> Result<u32> {
    require!(total_tickets >= 1, crate::ErrorCode::VrfNeedsTickets);
    let roll = u64::from_le_bytes(bytes[0..8].try_into().unwrap());
    Ok((roll % total_tickets as u64) as u32)
}
