import type { WalletSocialPublic } from "@/lib/social-profile-url";

/** Load Discord/X for wallets that participated in `drawId` (server enforces scope). */
export async function fetchWalletSocialsClient(
  wallets: string[],
  drawId: number,
): Promise<Record<string, WalletSocialPublic>> {
  const unique = [...new Set(wallets.filter(Boolean))];
  if (unique.length === 0 || !Number.isFinite(drawId) || drawId < 0) {
    return {};
  }
  try {
    const params = new URLSearchParams({
      drawId: String(drawId),
      wallets: unique.join(","),
    });
    const res = await fetch(`/api/profile/social?${params}`, {
      cache: "no-store",
    });
    if (!res.ok) return {};
    const json = (await res.json()) as {
      profiles?: Record<string, WalletSocialPublic>;
    };
    return json.profiles ?? {};
  } catch {
    return {};
  }
}
