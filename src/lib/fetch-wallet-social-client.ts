import type { WalletSocialPublic } from "@/lib/social-profile-url";

export async function fetchWalletSocialsClient(
  wallets: string[],
): Promise<Record<string, WalletSocialPublic>> {
  const unique = [...new Set(wallets.filter(Boolean))];
  if (unique.length === 0) return {};
  try {
    const res = await fetch(
      `/api/profile/social?wallets=${encodeURIComponent(unique.join(","))}`,
      { cache: "no-store" },
    );
    if (!res.ok) return {};
    const json = (await res.json()) as {
      profiles?: Record<string, WalletSocialPublic>;
    };
    return json.profiles ?? {};
  } catch {
    return {};
  }
}
