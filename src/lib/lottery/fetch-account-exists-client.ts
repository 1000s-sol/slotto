import { PublicKey } from "@solana/web3.js";

export async function fetchAccountExistsClient(
  address: PublicKey,
): Promise<boolean> {
  const res = await fetch(
    `/api/lottery/account-exists?address=${address.toBase58()}`,
    { cache: "no-store" },
  );
  const json = (await res.json()) as { exists?: boolean; error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? "Could not check account");
  }
  return json.exists === true;
}
