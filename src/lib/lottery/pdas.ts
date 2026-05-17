import { PublicKey } from "@solana/web3.js";

export function globalConfigPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    programId,
  );
  return pda;
}

export function drawPda(programId: PublicKey, drawId: number | bigint): PublicKey {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(drawId));
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("draw"), buf],
    programId,
  );
  return pda;
}

export function prizeVaultPda(programId: PublicKey, draw: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("prize_vault"), draw.toBuffer()],
    programId,
  );
  return pda;
}

export function ticketChunkPda(
  programId: PublicKey,
  draw: PublicKey,
  chunkIdx: number,
): PublicKey {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(chunkIdx);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("tickets"), draw.toBuffer(), buf],
    programId,
  );
  return pda;
}
