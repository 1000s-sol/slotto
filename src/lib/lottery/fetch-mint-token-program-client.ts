import { PublicKey } from "@solana/web3.js";

/** Resolve Token vs Token-2022 program via server RPC (DEADS and other Token-2022 mints). */
export async function fetchMintTokenProgramClient(
  mint: PublicKey,
): Promise<PublicKey> {
  const res = await fetch(
    `/api/lottery/mint-token-program?mint=${mint.toBase58()}`,
    { cache: "no-store" },
  );
  const json = (await res.json()) as { tokenProgram?: string; error?: string };
  if (!res.ok || !json.tokenProgram) {
    throw new Error(json.error ?? "Could not resolve token program");
  }
  return new PublicKey(json.tokenProgram);
}
