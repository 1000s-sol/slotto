import { getSocialByWallets } from "@/lib/user-profile-db";

export function shortWallet(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

/** Display name for embed: linked Discord / X, else truncated wallet. */
export async function buyerLabelForWallet(wallet: string): Promise<string> {
  const social = await getSocialByWallets([wallet]);
  const row = social[wallet];
  if (!row) return shortWallet(wallet);

  const discord = row.discord;
  if (discord?.username) return discord.username;

  const x = row.x;
  if (x?.username) return `@${x.username.replace(/^@/, "")}`;

  return shortWallet(wallet);
}
