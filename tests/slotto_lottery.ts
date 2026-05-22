import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SlottoLottery } from "../target/types/slotto_lottery";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { expect } from "chai";
import {
  chainUnixTs,
  drawPda,
  globalConfigPda,
  LAMPORTS_SOL_TICKET_TOTAL,
  LAMPORTS_SPL_TICKET_FEE_TOTAL,
  prizeVaultPda,
  sleep,
  ticketChunkPda,
} from "./pdas";

type SplMintRowArg = {
  mint: PublicKey;
  pricePerTicket: anchor.BN;
  mintDecimals: number;
  cap: number;
};

const DrawState = {
  Selling: 0,
  SalesClosed: 1,
  VrfRequested: 2,
  Settled: 3,
  Refunded: 4,
} as const;

describe("slotto_lottery", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SlottoLottery as Program<SlottoLottery>;
  const authority = (provider.wallet as anchor.Wallet).payer;
  // Must be funded system accounts — buy_sol_tickets transfers SOL to these.
  const teamVault = authority.publicKey;
  const buxVault = authority.publicKey;
  const setupVault = authority.publicKey;
  const globalConfig = globalConfigPda(program.programId);

  let nextDrawId = 0;

  before(async () => {
    const existing = await provider.connection.getAccountInfo(globalConfig);
    if (existing) {
      const cfg = await program.account.globalConfig.fetch(globalConfig);
      nextDrawId = cfg.nextDrawId.toNumber();
      return;
    }
    await program.methods
      .initialize(teamVault, buxVault, setupVault)
      .accounts({
        authority: authority.publicKey,
        globalConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  function allocDrawId(): number {
    const id = nextDrawId;
    nextDrawId += 1;
    return id;
  }

  async function createDraw(opts: {
    openOffsetSec: number;
    closeOffsetSec: number;
    seedLamports: number;
    splRows?: SplMintRowArg[];
  }): Promise<{ draw: PublicKey; prizeVault: PublicKey }> {
    const drawId = allocDrawId();
    const draw = drawPda(program.programId, drawId);
    const prizeVault = prizeVaultPda(program.programId, draw);
    const now = await chainUnixTs(provider.connection);

    await program.methods
      .createDraw(
        new anchor.BN(now + opts.openOffsetSec),
        new anchor.BN(now + opts.closeOffsetSec),
        PublicKey.default,
        new anchor.BN(opts.seedLamports),
        opts.splRows ?? []
      )
      .accounts({
        authority: authority.publicKey,
        globalConfig,
        draw,
        prizeVault,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { draw, prizeVault };
  }

  async function waitUntilSalesClose(
    draw: PublicKey,
    extraMs = 8_000
  ): Promise<void> {
    const drawAcct = await program.account.draw.fetch(draw);
    const closeTs = drawAcct.salesCloseTs.toNumber();
    const now = await chainUnixTs(provider.connection);
    const timeoutMs = Math.max(0, closeTs - now) * 1000 + extraMs;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const ts = await chainUnixTs(provider.connection);
      if (ts >= closeTs) return;
      await sleep(400);
    }
    throw new Error(
      `timed out waiting for sales_close_ts ${closeTs} (now ${await chainUnixTs(provider.connection)})`
    );
  }

  it("creates a draw with seeded prize vault", async () => {
    const seed = Math.floor(0.05 * LAMPORTS_PER_SOL);
    const { draw, prizeVault } = await createDraw({
      openOffsetSec: -60,
      closeOffsetSec: 3600,
      seedLamports: seed,
    });

    const drawAcct = await program.account.draw.fetch(draw);
    expect(drawAcct.state).to.equal(DrawState.Selling);
    expect(drawAcct.totalTickets).to.equal(0);

    const vaultBal = await provider.connection.getBalance(prizeVault);
    expect(vaultBal).to.be.gte(seed);
  });

  it("refunds an empty draw after sales close", async () => {
    const seed = Math.floor(0.02 * LAMPORTS_PER_SOL);
    const { draw, prizeVault } = await createDraw({
      openOffsetSec: -60,
      closeOffsetSec: 2,
      seedLamports: seed,
    });

    await waitUntilSalesClose(draw);

    await program.methods
      .closeSales()
      .accounts({
        draw,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .rpc();

    const refundBefore = await provider.connection.getBalance(
      authority.publicKey
    );

    await program.methods
      .refundEmptyDraw()
      .accounts({
        draw,
        prizeVault,
        seedRefund: authority.publicKey,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const drawAcct = await program.account.draw.fetch(draw);
    expect(drawAcct.state).to.equal(DrawState.Refunded);

    const refundAfter = await provider.connection.getBalance(
      authority.publicKey
    );
    expect(refundAfter).to.be.gt(refundBefore);
  });

  it("runs SOL buy → close → vrf → settle (stub)", async () => {
    const seed = Math.floor(0.01 * LAMPORTS_PER_SOL);
    const { draw, prizeVault } = await createDraw({
      openOffsetSec: -60,
      closeOffsetSec: 4,
      seedLamports: seed,
    });

    const chunk0 = ticketChunkPda(program.programId, draw, 0);
    const buyerBalBefore = await provider.connection.getBalance(
      authority.publicKey
    );

    await program.methods
      .buySolTickets(1)
      .accounts({
        buyer: authority.publicKey,
        draw,
        prizeVault,
        globalConfig,
        teamVault,
        buxVault,
        setupVault,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .remainingAccounts([
        { pubkey: chunk0, isWritable: true, isSigner: false },
      ])
      .rpc();

    const drawAfterBuy = await program.account.draw.fetch(draw);
    expect(drawAfterBuy.totalTickets).to.equal(1);

    const buyerBalAfterBuy = await provider.connection.getBalance(
      authority.publicKey
    );
    expect(buyerBalBefore - buyerBalAfterBuy).to.be.gte(
      LAMPORTS_SOL_TICKET_TOTAL
    );

    await waitUntilSalesClose(draw);

    await program.methods
      .closeSales()
      .accounts({
        draw,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .rpc();

    await program.methods
      .requestVrf()
      .accounts({ draw })
      .rpc();

    const drawVrf = await program.account.draw.fetch(draw);
    expect(drawVrf.state).to.equal(DrawState.VrfRequested);

    const winnerBalBefore = await provider.connection.getBalance(
      authority.publicKey
    );

    await program.methods
      .settle()
      .accounts({
        draw,
        prizeVault,
        clock: SYSVAR_CLOCK_PUBKEY,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts([
        { pubkey: chunk0, isWritable: true, isSigner: false },
        { pubkey: authority.publicKey, isWritable: true, isSigner: false },
      ])
      .rpc();

    const drawSettled = await program.account.draw.fetch(draw);
    expect(drawSettled.state).to.equal(DrawState.Settled);
    expect(drawSettled.winner.toBase58()).to.equal(
      authority.publicKey.toBase58()
    );
    expect(drawSettled.winningTicketId).to.equal(0);

    const winnerBalAfter = await provider.connection.getBalance(
      authority.publicKey
    );
    expect(winnerBalAfter).to.be.gt(winnerBalBefore);
  });

  it("buys SPL tickets into team wallet ATA", async () => {
    const mint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      6
    );
    const pricePerTicket = new anchor.BN(1_000_000);
    const { draw } = await createDraw({
      openOffsetSec: -60,
      closeOffsetSec: 3600,
      seedLamports: 0,
      splRows: [
        {
          mint,
          pricePerTicket,
          mintDecimals: 6,
          cap: 4,
        },
      ],
    });

    const buyerTokenAcct = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority,
      mint,
      authority.publicKey
    );
    const buyerAta = buyerTokenAcct.address;
    const teamAta = getAssociatedTokenAddressSync(
      mint,
      teamVault,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    await mintTo(
      provider.connection,
      authority,
      mint,
      buyerAta,
      authority.publicKey,
      10_000_000
    );

    const chunk0 = ticketChunkPda(program.programId, draw, 0);
    const buyerSolBefore = await provider.connection.getBalance(
      authority.publicKey
    );
    const buyerTokenBefore = await getAccount(
      provider.connection,
      buyerAta
    );

    await program.methods
      .buySplTickets(2)
      .accounts({
        buyer: authority.publicKey,
        draw,
        globalConfig,
        mint,
        teamVault,
        buyerToken: buyerAta,
        teamToken: teamAta,
        setupVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .remainingAccounts([
        { pubkey: chunk0, isWritable: true, isSigner: false },
      ])
      .rpc();

    const drawAcct = await program.account.draw.fetch(draw);
    expect(drawAcct.totalTickets).to.equal(2);
    expect(drawAcct.splMintRows[0].sold).to.equal(2);

    const teamToken = await getAccount(provider.connection, teamAta);
    expect(Number(teamToken.amount)).to.equal(2_000_000);

    const buyerTokenAfter = await getAccount(provider.connection, buyerAta);
    expect(Number(buyerTokenBefore.amount - buyerTokenAfter.amount)).to.equal(
      2_000_000
    );

    const buyerSolAfter = await provider.connection.getBalance(
      authority.publicKey
    );
    expect(buyerSolBefore - buyerSolAfter).to.be.gte(
      LAMPORTS_SPL_TICKET_FEE_TOTAL * 2
    );
  });
});
