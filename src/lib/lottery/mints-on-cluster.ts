import { Connection, PublicKey } from "@solana/web3.js";

import { mintExistsOnCluster } from "./mint-on-cluster";
import { resolveLotteryRpcUrl } from "./rpc-url";

/** Which mints exist on the cluster the server uses (mainnet when `LOTTERY_CLUSTER=mainnet-beta`). */
export async function mintsExistOnCluster(
  mints: string[],
): Promise<Record<string, boolean>> {
  const connection = new Connection(resolveLotteryRpcUrl(), "confirmed");
  const out: Record<string, boolean> = {};
  for (const mint of mints) {
    out[mint] = await mintExistsOnCluster(connection, new PublicKey(mint));
  }
  return out;
}
