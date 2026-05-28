import { Connection, PublicKey, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";

export const LAMPORTS_SOL_TICKET_TOTAL = 10_500_000;
/** Per SPL ticket: 0.0005 SOL fee (team + setup), from on-chain `LAMPORTS_SPL_TICKET_FEE_TOTAL`. */
export const LAMPORTS_SPL_TICKET_FEE_TOTAL = 500_000;

export function splVaultAuthPda(programId: PublicKey, draw: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("spl_vault_auth"), draw.toBuffer()],
    programId
  );
  return pda;
}

export function globalConfigPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    programId
  );
  return pda;
}

export function drawPda(programId: PublicKey, drawId: number | bigint): PublicKey {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(drawId));
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("draw"), buf],
    programId
  );
  return pda;
}

export function prizeVaultPda(programId: PublicKey, draw: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("prize_vault"), draw.toBuffer()],
    programId
  );
  return pda;
}

export function ticketChunkPda(
  programId: PublicKey,
  draw: PublicKey,
  chunkIdx: number
): PublicKey {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(chunkIdx);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("tickets"), draw.toBuffer(), buf],
    programId
  );
  return pda;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Same clock the program uses (`Clock` sysvar), not host `Date.now()`. */
export async function chainUnixTs(connection: Connection): Promise<number> {
  const info = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "processed");
  if (!info || info.data.length < 40) {
    throw new Error("could not read Clock sysvar");
  }
  return Number(info.data.readBigInt64LE(32));
}
